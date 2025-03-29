import { Request, Response } from 'express';
import Stripe from 'stripe';
import { syncStripeDataToKV } from '../utils/stripe-utils';
import dotenv from 'dotenv';
import express from 'express';
import { UserModel } from '../models/User';
import { PlanModel } from '../models/Plan';
import { redisClient } from '../server';
import { Types } from 'mongoose';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret: string = process.env.STRIPE_WEBHOOK_SECRET!;

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not defined in the environment.");
}

if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not defined in the environment.");
}

export const rawBodyMiddleware = express.raw({ type: 'application/json' });

export const stripeWebhookHandler = async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
        console.warn('No signature found');
        return res.status(400).send('No signature found');
    }

    try {
        const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
        const processed = await processEvent(event);
        res.status(200).send({ received: true, processed });
    } catch (error: any) {
        console.error('Webhook signature verification failed:', error);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }
};

const allowedEvents: Stripe.Event.Type[] = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.paused',
    'customer.subscription.resumed',
    'customer.subscription.pending_update_applied',
    'customer.subscription.pending_update_expired',
    'customer.subscription.trial_will_end',
    'invoice.paid',
    'invoice.payment_failed',
    'invoice.payment_action_required',
    'invoice.upcoming',
    'invoice.marked_uncollectible',
    'invoice.payment_succeeded',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'payment_intent.canceled',
];

async function processEvent(event: Stripe.Event): Promise<boolean> {
    if (!allowedEvents.includes(event.type)) {
        console.log(`Event ${event.type} not allowed`);
        return false;
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event);
                break;
            default:
                if ((event.type === 'customer.subscription.created' ||
                    event.type === 'customer.subscription.updated' ||
                    event.type === 'customer.subscription.deleted') &&
                    (event.data.object as any).customer) {

                    const { customer: customerId } = event.data.object as { customer: string };

                    if (typeof customerId !== 'string') {
                        console.error(`[STRIPE HOOK] ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
                        return false;
                    }

                    await syncStripeDataToKV(customerId);
                }
                break;
        }
        return true;
    } catch (error) {
        console.error(`Error processing event ${event.id} of type ${event.type}:`, error);
        return false;
    }
}

// Type predicate to check if a Customer is an active customer with metadata
function isCustomerWithMetadata(customer: Stripe.Customer | Stripe.DeletedCustomer): customer is Stripe.Customer & { metadata: { userId: string } } {
    if ((customer as Stripe.DeletedCustomer).deleted === true) {
        return false; // It's a deleted customer, so it doesn't have metadata we need
    }

    // Now we can safely assert that it's a Stripe.Customer and access metadata
    const customerWithMetadata = customer as Stripe.Customer; // Type assertion to Stripe.Customer

    return customerWithMetadata.metadata !== undefined &&
           typeof customerWithMetadata.metadata.userId === 'string';
}
async function handleCheckoutSessionCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;

    if (!session.customer) {
        console.error("[STRIPE HOOK] No customer on session for checkout.session.completed:", session);
        return;
    }

    const stripeCustomerId = session.customer as string;

    try {
        // Retrieve the customer from Stripe
        const customer = await stripe.customers.retrieve(stripeCustomerId);

        // Check if the customer is an active customer with metadata
        if (!isCustomerWithMetadata(customer)) {
            console.error("[STRIPE HOOK] Customer is deleted or missing userId in metadata:", customer);
            return;
        }

        const clerkId = customer.metadata.userId;
        const proPlanName = "Pro";

        // Find the Pro plan in your database
        const proPlan = await PlanModel.findOne({ name: proPlanName });

        if (!proPlan) {
            console.error("[STRIPE HOOK] Pro plan not found");
            return;
        }

        // Find the user by clerkId
        const user = await UserModel.findOne({ clerkId: clerkId });

        if (!user) {
            console.error("[STRIPE HOOK] User not found for clerkId:", clerkId);
            return;
        }

        // Update the user's plan with proper type conversion
        if (proPlan._id) { // Check if _id exists
            user.planId = new Types.ObjectId(proPlan._id.toString());
            await user.save();

            // Update Redis cache
            await redisClient.set(`user:${clerkId}`, JSON.stringify(user));

            console.log(`[STRIPE HOOK] Updated plan for user ${clerkId} to Pro`);

            // Sync
            await syncStripeDataToKV(stripeCustomerId);
        } else {
            console.error("[STRIPE HOOK] Pro plan _id is undefined");
        }



    } catch (error: any) {
        console.error("[STRIPE HOOK] Error updating user plan after checkout:", error);
    }
}