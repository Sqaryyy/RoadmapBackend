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
            case 'customer.subscription.paused':
                await handleSubscriptionPaused(event);
                break;
            case 'customer.subscription.resumed':
                await handleSubscriptionResumed(event);
                break;
            case 'customer.subscription.trial_will_end':
                await handleTrialWillEnd(event);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event);
                break;
            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event);
                break;
            case 'invoice.payment_action_required':
                await handlePaymentActionRequired(event);
                break;
                case 'invoice.paid':
                    case 'invoice.payment_succeeded': {
                        // Handle successful payments
                        const invoice = event.data.object as Stripe.Invoice;
                        const invoiceCustomerId = invoice.customer as string;
                    
                        // Sync subscription data
                        await syncStripeDataToKV(invoiceCustomerId);
                    
                        // Update user payment status to successful
                        try {
                            const customer = await stripe.customers.retrieve(invoiceCustomerId);
                            if (isCustomerWithMetadata(customer)) {
                                const clerkId = customer.metadata.userId;
                                const user = await UserModel.findOne({ clerkId });
                                if (user) {
                                    // Clear payment issues if you've added that field
                                    if ('paymentIssue' in user) {
                                        user.paymentIssue = false;
                                    }
                    
                                    user.updatedAt = new Date();
                                    await user.save();
                                    await redisClient.set(`user:${clerkId}`, JSON.stringify(user));
                                }
                            }
                        } catch (err) {
                            console.error("[STRIPE HOOK] Error updating user after successful payment:", err);
                        }
                        break;
                    }
                    case 'customer.subscription.created':
                    case 'customer.subscription.updated':
                    case 'customer.subscription.pending_update_applied':
                    case 'customer.subscription.pending_update_expired': {
                            // Handle other subscription events
                            const subscription = event.data.object as Stripe.Subscription;
                            const subscriptionCustomerId = subscription.customer as string;
                        
                            if (typeof subscriptionCustomerId !== 'string') {
                                console.error(`[STRIPE HOOK] ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
                                return false;
                            }
                        
                            await syncStripeDataToKV(subscriptionCustomerId);
                        
                            // For subscription.created and subscription.updated, ensure user has Pro plan
                            if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
                                try {
                                    const status = subscription.status;
                        
                                    const customer = await stripe.customers.retrieve(subscriptionCustomerId);
                                    if (isCustomerWithMetadata(customer)) {
                                        const clerkId = customer.metadata.userId;
                                        const user = await UserModel.findOne({ clerkId });
                        
                                        if (user) {
                                            // Ensure Pro plan is applied
                                            const proPlan = await PlanModel.findOne({ name: "Pro" });
                                            if (proPlan && proPlan._id) {
                                                user.planId = new Types.ObjectId(proPlan._id.toString());
                                            }
                        
                                            // Update subscription status based on Stripe's status
                                            if ('subscriptionStatus' in user) {
                                                user.subscriptionStatus = status; //  <-- SET IT DIRECTLY!
                                            }
                        
                                            // Store subscription ID if you've added that field
                                            if ('subscriptionId' in user) {
                                                user.subscriptionId = subscription.id;
                                            }
                        
                                            // Store period end date if you've added that field
                                            if ('currentPeriodEnd' in user && subscription.current_period_end) {
                                                user.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
                                            }
                        
                                            user.updatedAt = new Date();
                                            await user.save();
                                            await redisClient.set(`user:${clerkId}`, JSON.stringify(user));
                        
                                            console.log(`[STRIPE HOOK] Updated subscription for user ${clerkId} with status: ${status}`);
                                        }
                                    }
                                } catch (err) {
                                    console.error("[STRIPE HOOK] Error updating user after subscription change:", err);
                                }
                            }
                            break;
                        }
            case 'payment_intent.succeeded':
            case 'payment_intent.payment_failed':
            case 'payment_intent.canceled':
                // Payment intent events could be handled similarly to invoice events
                // These are typically for one-time payments rather than subscriptions
                console.log(`[STRIPE HOOK] Payment intent event: ${event.type}`);
                break;
            default:
                console.log(`[STRIPE HOOK] Unhandled event type: ${event.type}`);
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

async function handleSubscriptionPaused(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    
    try {
        // Sync Stripe data to KV storage
        await syncStripeDataToKV(customerId);
        
        // Find user associated with this subscription
        const customer = await stripe.customers.retrieve(customerId);
        if (!isCustomerWithMetadata(customer)) {
            console.error("[STRIPE HOOK] Customer is deleted or missing userId in metadata:", customer);
            return;
        }
        
        const clerkId = customer.metadata.userId;
        const user = await UserModel.findOne({ clerkId });
        
        if (!user) {
            console.error("[STRIPE HOOK] User not found for clerkId:", clerkId);
            return;
        }
        
        // Update user's subscription status
        // If you've added the subscriptionStatus field:
        if ('subscriptionStatus' in user) {
            user.subscriptionStatus = 'paused';
        }
        
        // Make sure to always update the updatedAt timestamp
        user.updatedAt = new Date();
        await user.save();
        
        // Update Redis cache
        await redisClient.set(`user:${clerkId}`, JSON.stringify(user));
        
        console.log(`[STRIPE HOOK] Marked subscription as paused for user ${clerkId}`);
        
        // Optional: Send notification to user about paused subscription
    } catch (error) {
        console.error("[STRIPE HOOK] Error handling subscription pause:", error);
    }
}

// Handle subscription resume
async function handleSubscriptionResumed(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    
    try {
        // Sync Stripe data to KV storage
        await syncStripeDataToKV(customerId);
        
        // Find user associated with this subscription
        const customer = await stripe.customers.retrieve(customerId);
        if (!isCustomerWithMetadata(customer)) {
            console.error("[STRIPE HOOK] Customer is deleted or missing userId in metadata:", customer);
            return;
        }
        
        const clerkId = customer.metadata.userId;
        const user = await UserModel.findOne({ clerkId });
        
        if (!user) {
            console.error("[STRIPE HOOK] User not found for clerkId:", clerkId);
            return;
        }
        
        // Update user's subscription status
        // If you've added the subscriptionStatus field:
        if ('subscriptionStatus' in user) {
            user.subscriptionStatus = 'active';
        }
        
        // Make sure Pro plan is still applied
        const proPlan = await PlanModel.findOne({ name: "Pro" });
        if (proPlan && proPlan._id) {
            user.planId = new Types.ObjectId(proPlan._id.toString());
        }
        
        user.updatedAt = new Date();
        await user.save();
        
        // Update Redis cache
        await redisClient.set(`user:${clerkId}`, JSON.stringify(user));
        
        console.log(`[STRIPE HOOK] Marked subscription as resumed for user ${clerkId}`);
        
        // Optional: Send welcome back notification to user
    } catch (error) {
        console.error("[STRIPE HOOK] Error handling subscription resume:", error);
    }
}

// Handle trial ending soon notification
async function handleTrialWillEnd(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    const trialEnd = subscription.trial_end;
    
    try {
        // Find user associated with this subscription
        const customer = await stripe.customers.retrieve(customerId);
        if (!isCustomerWithMetadata(customer)) {
            console.error("[STRIPE HOOK] Customer is deleted or missing userId in metadata:", customer);
            return;
        }
        
        const clerkId = customer.metadata.userId;
        const user = await UserModel.findOne({ clerkId });
        
        if (!user) {
            console.error("[STRIPE HOOK] User not found for clerkId:", clerkId);
            return;
        }
        
        // If you've added the trialEndDate field:
        if ('trialEndDate' in user && trialEnd) {
            user.trialEndDate = new Date(trialEnd * 1000); // Convert UNIX timestamp to date
        }
        
        user.updatedAt = new Date();
        await user.save();
        
        // Update Redis cache
        await redisClient.set(`user:${clerkId}`, JSON.stringify(user));
        
        console.log(`[STRIPE HOOK] Trial ending soon for user ${clerkId} at ${new Date(trialEnd! * 1000)}`);
        
        // Send notification to user about trial ending soon (email, in-app, etc.)
        // Your notification logic here...
    } catch (error) {
        console.error("[STRIPE HOOK] Error handling trial end notification:", error);
    }
}

// Handle invoice payment failure
async function handleInvoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;
    
    try {
        // Find user associated with this invoice
        const customer = await stripe.customers.retrieve(customerId);
        if (!isCustomerWithMetadata(customer)) {
            console.error("[STRIPE HOOK] Customer is deleted or missing userId in metadata:", customer);
            return;
        }
        
        const clerkId = customer.metadata.userId;
        const user = await UserModel.findOne({ clerkId });
        
        if (!user) {
            console.error("[STRIPE HOOK] User not found for clerkId:", clerkId);
            return;
        }
        
        // If you've added the paymentIssue fields:
        if ('paymentIssue' in user) {
            user.paymentIssue = true;
        }
        
        if ('lastFailedPayment' in user) {
            user.lastFailedPayment = new Date();
        }
        
        // You might want to update the subscription status as well
        if ('subscriptionStatus' in user) {
            user.subscriptionStatus = 'past_due';
        }
        
        user.updatedAt = new Date();
        await user.save();
        
        // Update Redis cache
        await redisClient.set(`user:${clerkId}`, JSON.stringify(user));
        
        console.log(`[STRIPE HOOK] Payment failed for user ${clerkId}, invoice ID: ${invoice.id}`);
        
        // Send payment failure notification to user
        // Your notification logic here...
    } catch (error) {
        console.error("[STRIPE HOOK] Error handling invoice payment failure:", error);
    }
}

// Handle invoice requiring payment action
async function handlePaymentActionRequired(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;
    
    try {
        // Find user associated with this invoice
        const customer = await stripe.customers.retrieve(customerId);
        if (!isCustomerWithMetadata(customer)) {
            console.error("[STRIPE HOOK] Customer is deleted or missing userId in metadata:", customer);
            return;
        }
        
        const clerkId = customer.metadata.userId;
        
        console.log(`[STRIPE HOOK] Payment action required for user ${clerkId}, invoice ID: ${invoice.id}`);
        
        // Send notification to user about required action
        // Your notification logic here...
    } catch (error) {
        console.error("[STRIPE HOOK] Error handling payment action required:", error);
    }
}

// Handle subscription deletion (cancellation)
async function handleSubscriptionDeleted(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    
    try {
        // Sync Stripe data to KV storage
        await syncStripeDataToKV(customerId);
        
        // Find user associated with this subscription
        const customer = await stripe.customers.retrieve(customerId);
        if (!isCustomerWithMetadata(customer)) {
            console.error("[STRIPE HOOK] Customer is deleted or missing userId in metadata:", customer);
            return;
        }
        
        const clerkId = customer.metadata.userId;
        const user = await UserModel.findOne({ clerkId });
        
        if (!user) {
            console.error("[STRIPE HOOK] User not found for clerkId:", clerkId);
            return;
        }
        
        // Find free plan
        const freePlan = await PlanModel.findOne({ name: "Free" });
        if (!freePlan || !freePlan._id) {
            console.error("[STRIPE HOOK] Free plan not found");
            return;
        }
        
        // Downgrade user to free plan
        user.planId = new Types.ObjectId(freePlan._id.toString());
        
        // Update subscription status
        if ('subscriptionStatus' in user) {
            user.subscriptionStatus = 'canceled';
        }
        
        // Reset the subscription ID if you've added that field
        if ('subscriptionId' in user) {
            user.subscriptionId = undefined;
        }
        
        user.updatedAt = new Date();
        await user.save();
        
        // Update Redis cache
        await redisClient.set(`user:${clerkId}`, JSON.stringify(user));
        
        console.log(`[STRIPE HOOK] Downgraded user ${clerkId} to Free plan after subscription canceled`);
        
        // Optional: Send notification to user about subscription cancellation
    } catch (error) {
        console.error("[STRIPE HOOK] Error handling subscription deletion:", error);
    }
}