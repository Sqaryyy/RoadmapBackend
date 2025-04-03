import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { User } from '../interfaces/IUser';
import Stripe from 'stripe';
import { PlanModel } from '../models/Plan';
import Redis from 'ioredis';
import { syncStripeDataToKV } from '../utils/stripe-utils';

const redisClient = new Redis(process.env.REDIS_URL!);
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
        
        // Check if streak needs updating
        await updateUserStreak(user);
        
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

// Helper function to check if streak has expired (called with each user access)
const checkStreakExpiration = async (user: User) => {
    try {
        const lastPointsKey = `lastPoints:${user.clerkId}`;
        const lastPointsTimestamp = await redisClient.get(lastPointsKey);

        if (!lastPointsTimestamp) {
            if (Number(user.dayStreak || 0) > 0) {
                user.dayStreak = 0;
                await user.save();
            }
            return;
        }

        const lastPointsTime = parseInt(lastPointsTimestamp);
        const currentTime = Date.now();

        // 24 hours in milliseconds = 86400000
        if (currentTime - lastPointsTime > 86400000) {
            // More than 24 hours have passed since last points, reset streak
            user.dayStreak = 0;
            await user.save();
        }

        return user;
    } catch (error) {
        console.error('Error checking streak expiration:', error);
        throw error;
    }
};
// Add Points to User
export const addUserPoints = async (req: Request, res: Response) => {
    try {
        const { userId, points } = req.body;
        
        if (!userId || !points || isNaN(points) || points <= 0) {
            return res.status(400).json({ message: 'Valid userId and positive points value are required' });
        }
        
        const user = await UserModel.findOne({ clerkId: userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Update points
        user.points = Number(user.points || 0) + Number(points);
        
        // Update streak based on points earned
        await updateStreakWithPoints(user);
        
        const savedUser = await user.save();
        res.status(200).json({ 
            message: 'Points added successfully', 
            user: { 
                points: savedUser.points, 
                dayStreak: savedUser.dayStreak 
            } 
        });
    } catch (error: any) {
        console.error('Error adding points:', error);
        res.status(500).json({ message: error.message });
    }
};

// Helper function to update streak when points are earned
const updateStreakWithPoints = async (user: User) => {
    try {
        const lastPointsKey = `lastPoints:${user.clerkId}`;
        const lastPointsDateKey = `lastPointsDate:${user.clerkId}`;
        
        const lastPointsTimestamp = await redisClient.get(lastPointsKey);
        const lastPointsDate = await redisClient.get(lastPointsDateKey);
        
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Set current timestamp for streak expiration check
        await redisClient.set(lastPointsKey, now.getTime().toString());
        
        if (!lastPointsDate) {
            // First time getting points, set streak to 1
            user.dayStreak = 1;
            await redisClient.set(lastPointsDateKey, today);
            return;
        }
        
        if (lastPointsDate === today) {
            // Already earned points today, don't increase streak
            return;
        }
        
        // Check if the last points date was yesterday
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (lastPointsDate === yesterdayStr) {
            // Earned points yesterday, increment streak
            user.dayStreak = Number(user.dayStreak || 0) + 1;
        } else {
            // Gap in points earning, reset streak to 1
            user.dayStreak = 1;
        }
        
        // Update the last points date
        await redisClient.set(lastPointsDateKey, today);
        
        return user;
    } catch (error) {
        console.error('Error updating streak with points:', error);
        throw error;
    }
};

// Reset Streak for User
export const resetUserStreak = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ message: 'UserId is required' });
        }
        
        const user = await UserModel.findOne({ clerkId: userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        user.dayStreak = 0;
        
        // Clear redis keys for this user's streak
        await redisClient.del(`lastPoints:${userId}`);
        await redisClient.del(`lastPointsDate:${userId}`);
        
        const savedUser = await user.save();
        
        res.status(200).json({ 
            message: 'Streak reset successfully', 
            user: { dayStreak: savedUser.dayStreak } 
        });
    } catch (error: any) {
        console.error('Error resetting streak:', error);
        res.status(500).json({ message: error.message });
    }
};

export const createSubscription = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const proPlanName = "Pro";

        console.log("createSubscription: Received request for clerkId:", userId);

        const user = await UserModel.findOne({ clerkId: userId });

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

        let stripeCustomerId = await redisClient.get(`stripe:user:${userId}`);

        console.log("createSubscription: Retrieved stripeCustomerId from Redis:", stripeCustomerId);

        if (!stripeCustomerId) {
            console.log("createSubscription: stripeCustomerId not found, creating new customer");
            const newCustomer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    userId: userId,
                },
            });

            await redisClient.set(`stripe:user:${userId}`, newCustomer.id);
            stripeCustomerId = newCustomer.id;
            console.log("createSubscription: Created new Stripe customer with ID:", stripeCustomerId);
        }

        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: proPlan.stripePriceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL}/success`,
            cancel_url: `${process.env.FRONTEND_URL}/cancel`,
        });

        console.log("createSubscription: Stripe Checkout session created with URL:", session.url);
        res.status(200).json({ url: session.url });
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

// This function needs to be defined somewhere in your code
async function updateUserStreak(user: User) {
    try {
        await checkStreakExpiration(user);
    } catch (error) {
        console.error('Error updating user streak:', error);
    }
}