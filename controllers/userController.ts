import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { User } from '../interfaces/IUser';
import Stripe from 'stripe';
import { PlanModel } from '../models/Plan'; // Assuming you have your Plan model
import Redis from 'ioredis';
import { syncStripeDataToKV } from '../utils/stripe-utils';

const redisClient = new Redis(process.env.REDIS_URL!); // Ensure REDIS_URL is set
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Create User
export const createUser = async (req: Request, res: Response) => {
    try {
        const newUser: User = req.body;
        const user = new UserModel(newUser);
        const savedUser = await user.save();
        res.status(201).json(savedUser);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Get User by ID
export const getUserById = async (req: Request, res: Response) => {
    try {
        const user = await UserModel.findById(req.params.id).populate('skills');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Get User by Clerk ID
export const getUserByClerkId = async (req: Request, res: Response) => {
    try {
        const user = await UserModel.findOne({ clerkId: req.params.clerkId }).populate('skills');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Update User
export const updateUser = async (req: Request, res: Response) => {
    try {
        const updatedUser = await UserModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(updatedUser);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Delete User
export const deleteUser = async (req: Request, res: Response) => {
    try {
        const deletedUser = await UserModel.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted' });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

export const createSubscription = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body; // Assuming you have user authentication (e.g., Clerk)
        const proPlanName = "Pro";

        console.log("createSubscription: Received request for clerkId:", userId);

        // Find the user by clerkId
        const user = await UserModel.findOne({ clerkId: userId });  // Use findOne, not findById

        if (!user) {
            console.log("createSubscription: User not found for clerkId:", userId);
            return res.status(404).json({ message: 'User not found' });
        }

        const proPlan = await PlanModel.findOne({ name: proPlanName });

        if (!proPlan) {
            console.log("createSubscription: Pro plan not found");
            return res.status(404).json({ message: 'Pro plan not found' });
        }

        if (!proPlan.stripePriceId) {
            console.log("createSubscription: Pro plan Stripe Price ID not configured");
            return res.status(500).json({ message: 'Pro plan Stripe Price ID is not configured.' });
        }

        // Get the stripeCustomerId from your KV store
        let stripeCustomerId = await redisClient.get(`stripe:user:${userId}`); // Use clerkId

        console.log("createSubscription: Retrieved stripeCustomerId from Redis:", stripeCustomerId);

        // Create a new Stripe customer if this user doesn't have one
        if (!stripeCustomerId) {
            console.log("createSubscription: stripeCustomerId not found, creating new customer");
            const newCustomer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    userId: userId, // Use clerkId
                },
            });

            // Store the relation between clerkId and stripeCustomerId in your KV
            await redisClient.set(`stripe:user:${userId}`, newCustomer.id); // Use clerkId
            stripeCustomerId = newCustomer.id;
            console.log("createSubscription: Created new Stripe customer with ID:", stripeCustomerId);
        }

        // ALWAYS create a checkout with a stripeCustomerId. They should enforce this.
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: proPlan.stripePriceId, // Use the Stripe Price ID from the Pro plan
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL}/success`, // No session id on success url
            cancel_url: `${process.env.FRONTEND_URL}/cancel`,
        });

        console.log("createSubscription: Stripe Checkout session created with URL:", session.url);
        res.status(200).json({ url: session.url }); // Send the Checkout URL to the client
        console.log("createSubscription: Response sent with status 200 and URL");

    } catch (error: any) {
        console.error('createSubscription: Error creating Stripe Checkout session:', error);
        res.status(500).json({ message: 'Error creating Stripe Checkout session', error: (error as Error).message });
        console.log("createSubscription: Error response sent with status 500");
    }
};

export const success = async (req: Request, res: Response) => {
    try {
        //Fixing the error
        const { userId } = req.body;// Assuming you have user authentication (e.g., Clerk)
        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const stripeCustomerId = await redisClient.get(`stripe:user:${userId}`);

        if (!stripeCustomerId) {
            // Handle the case where the customer ID is not found
            return res.status(404).json({ message: 'Stripe customer ID not found' });
        }

        // Ensure syncStripeDataToKV is properly imported and configured
        const stripeData = await syncStripeDataToKV(stripeCustomerId);

        return res.status(200).json({ message: "Success!  Stripe data synced.", stripeData });
    } catch (error: any) {
        console.error('Error syncing Stripe data in success route:', error);
        res.status(500).json({ message: 'Error syncing Stripe data', error: (error as Error).message });
    }
};