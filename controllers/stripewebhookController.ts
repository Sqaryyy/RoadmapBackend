import { Request, Response } from 'express';
import Stripe from 'stripe';
import { syncStripeDataToKV } from '../utils/stripe-utils';
import dotenv from 'dotenv';
import express from 'express';
import { UserModel } from '../models/User';
import { PlanModel } from '../models/Plan';
import redisClient from '../utils/redisClient';
import { Types } from 'mongoose';
import { sendSubscriptionCanceledEmail,sendPaymentFailedEmail,sendSubscriptionPausedEmail,sendSubscriptionResumedEmail,sendTrialEndingSoonEmail,sendWelcomeEmail, sendSubscriptionCreatedEmail, sendSubscriptionUpdatedEmail, sendPaymentIntentSucceededEmail, sendPaymentIntentFailedEmail, sendPaymentIntentCanceledEmail } from '../utils/resend-utils';

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
            case 'customer.subscription.created':
                await handleSubscriptionCreated(event);
                break;
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event);
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

                        if (typeof invoiceCustomerId !== 'string') {
                            console.error(`[STRIPE HOOK] Customer ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
                            return false;
                        }
                    
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
                                                if (typeof proPlan._id === 'string') {
                                                  user.planId = new Types.ObjectId(proPlan._id);
                                                } else {
                                                  user.planId = new Types.ObjectId(proPlan._id.toString());
                                                }
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
                                            // Add this code where you update the user's fields:
                                            if ('cancelAtPeriodEnd' in user) {
                                                user.cancelAtPeriodEnd = subscription.cancel_at_period_end;
                                            }
                        
                                            user.updatedAt = new Date();
                                            await user.save();
                                            await redisClient.set(`user:${clerkId}`, JSON.stringify(user));
                        
                                            console.log(`[STRIPE HOOK] Updated subscription for user ${clerkId} with status: ${status}`);
                                            // Determine the event name for the email
                                            let eventName = 'created';
                                            if(event.type === 'customer.subscription.updated') {
                                                eventName = 'updated';
                                            }
                        
                                            if (user && user.email) {
                                                // subscription.plan.name is not correct, we should get the plan name from our DB
                                                const plan = await PlanModel.findById(user.planId);
                                                if(plan) {
                                                    const emailSent = await ( eventName === 'created' ? sendSubscriptionCreatedEmail(user.email, plan.name) : sendSubscriptionUpdatedEmail(user.email, 'previousPlan', plan.name));
                                                    if (emailSent) {
                                                        console.log(`[STRIPE HOOK] Subscription ${eventName} email sent to ${user.email}`);
                                                    } else {
                                                        console.error(`[STRIPE HOOK] Failed to send subscription ${eventName} email to ${user.email}`);
                                                    }
                                                } else {
                                                    console.warn("[STRIPE HOOK] User plan not found, cannot send subscription email.");
                                                }
                        
                                            } else {
                                                console.warn("[STRIPE HOOK] User email not found, cannot send subscription email.");
                                            }
                        
                                        }
                                    }
                                } catch (err) {
                                    console.error("[STRIPE HOOK] Error updating user after subscription change:", err);
                                }
                            }
                            break;
                        }
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                const customerId = paymentIntent.customer as string;

                if (typeof customerId !== 'string') {
                    console.error(`[STRIPE HOOK] Customer ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
                    return false;
                }
                try {
                    const customer = await stripe.customers.retrieve(customerId);
                    if (isCustomerWithMetadata(customer)) {
                        const clerkId = customer.metadata.userId;
                        const user = await UserModel.findOne({ clerkId });

                        if (user && user.email) {
                            // Convert amount from cents to dollars
                            const amount = paymentIntent.amount / 100;
                            const emailSent = await sendPaymentIntentSucceededEmail(user.email, amount);
                            if (emailSent) {
                                console.log(`[STRIPE HOOK] Payment intent succeeded email sent to ${user.email}`);
                            } else {
                                console.error(`[STRIPE HOOK] Failed to send payment intent succeeded email to ${user.email}`);
                            }
                        } else {
                            console.warn("[STRIPE HOOK] User email not found, cannot send payment intent succeeded email.");
                        }
                    }
                } catch (error) {
                    console.error("[STRIPE HOOK] Error handling payment intent succeeded:", error);
                }
                break;
            }
            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                const customerId = paymentIntent.customer as string;
                if (typeof customerId !== 'string') {
                    console.error(`[STRIPE HOOK] Customer ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
                    return false;
                }
                try {
                    const customer = await stripe.customers.retrieve(customerId);
                    if (isCustomerWithMetadata(customer)) {
                        const clerkId = customer.metadata.userId;
                        const user = await UserModel.findOne({ clerkId });

                        if (user && user.email) {
                            const emailSent = await sendPaymentIntentFailedEmail(user.email);
                            if (emailSent) {
                                console.log(`[STRIPE HOOK] Payment intent failed email sent to ${user.email}`);
                            } else {
                                console.error(`[STRIPE HOOK] Failed to send payment intent failed email to ${user.email}`);
                            }
                        } else {
                            console.warn("[STRIPE HOOK] User email not found, cannot send payment intent failed email.");
                        }
                    }
                } catch (error) {
                    console.error("[STRIPE HOOK] Error handling payment intent failed:", error);
                }
                break;
            }
            case 'payment_intent.canceled': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                const customerId = paymentIntent.customer as string;

                if (typeof customerId !== 'string') {
                    console.error(`[STRIPE HOOK] Customer ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
                    return false;
                }
                try {
                    const customer = await stripe.customers.retrieve(customerId);
                    if (isCustomerWithMetadata(customer)) {
                        const clerkId = customer.metadata.userId;
                        const user = await UserModel.findOne({ clerkId });

                        if (user && user.email) {
                            const emailSent = await sendPaymentIntentCanceledEmail(user.email);
                            if (emailSent) {
                                console.log(`[STRIPE HOOK] Payment intent canceled email sent to ${user.email}`);
                            } else {
                                console.error(`[STRIPE HOOK] Failed to send payment intent canceled email to ${user.email}`);
                            }
                        } else {
                            console.warn("[STRIPE HOOK] User email not found, cannot send payment intent canceled email.");
                        }
                    }
                } catch (error) {
                    console.error("[STRIPE HOOK] Error handling payment intent canceled:", error);
                }
                break;
            }

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

    if (typeof stripeCustomerId !== 'string') {
        console.error(`[STRIPE HOOK] Customer ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
        return;
    }

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
            if (typeof proPlan._id === 'string') {
              user.planId = new Types.ObjectId(proPlan._id);
            } else {
              user.planId = new Types.ObjectId(proPlan._id.toString());
            }
            await user.save();

            // Update Redis cache
            await redisClient.set(`user:${clerkId}`, JSON.stringify(user));

            console.log(`[STRIPE HOOK] Updated plan for user ${clerkId} to Pro`);

            // **COMMENT OUT the Welcome Email**
            // if (user && user.email) {
            //     const emailSent = await sendWelcomeEmail(user.email);
            //     if (emailSent) {
            //         console.log(`[STRIPE HOOK] Welcome email sent to ${user.email}`);
            //     } else {
            //         console.error(`[STRIPE HOOK] Failed to send welcome email to ${user.email}`);
            //     }
            // } else {
            //     console.warn("[STRIPE HOOK] User email not found, cannot send welcome email.");
            // }

            // Sync
            await syncStripeDataToKV(stripeCustomerId);
        } else {
            console.error("[STRIPE HOOK] Pro plan _id is undefined");
        }



    } catch (error: any) {
        console.error("[STRIPE HOOK] Error updating user plan after checkout:", error);
    }
}

async function handleSubscriptionCreated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    if (typeof customerId !== 'string') {
        console.error(`[STRIPE HOOK] Customer ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
        return;
    }

    try {
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

        if (user && user.email) {
            // subscription.plan.name is not correct, we should get the plan name from our DB
            const plan = await PlanModel.findById(user.planId);
            if(plan) {
                const emailSent = await sendSubscriptionCreatedEmail(user.email, plan.name);
                if (emailSent) {
                    console.log(`[STRIPE HOOK] Subscription created email sent to ${user.email}`);
                } else {
                    console.error(`[STRIPE HOOK] Failed to send subscription created email to ${user.email}`);
                }
            } else {
                console.warn("[STRIPE HOOK] User plan not found, cannot send subscription created email.");
            }

        } else {
            console.warn("[STRIPE HOOK] User email not found, cannot send subscription created email.");
        }

    } catch (error) {
        console.error("[STRIPE HOOK] Error handling subscription created:", error);
    }
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    if (typeof customerId !== 'string') {
        console.error(`[STRIPE HOOK] Customer ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
        return;
    }

    try {
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

        if (user && user.email) {
            const currentPlan = await PlanModel.findById(user.planId);

            let previousPlanName = "Unknown Plan";
            if (
                subscription.items &&
                subscription.items.data &&
                subscription.items.data.length > 0 &&
                subscription.items.data[0].plan && typeof subscription.items.data[0].plan === 'object' && 'id' in subscription.items.data[0].plan
            ) {

                try {
                    const stripePlan = await stripe.plans.retrieve((subscription.items.data[0].plan as any).id);
                    if (stripePlan) {
                        previousPlanName = stripePlan.nickname || "Unknown Plan"; // Use nickname or default
                    } else {
                        console.warn(`[STRIPE HOOK] Previous plan not found from Stripe: ${(subscription.items.data[0].plan as any).id}`);
                    }
                } catch (err) {
                    console.error("[STRIPE HOOK] Could not fetch the previous plan with that ID");
                }
            }

            if (currentPlan) {
                // Check if the subscription was just set to cancel at the end of the period
                if (
                    subscription.cancel_at_period_end === true &&
                    event.data.previous_attributes &&  // Check if previous_attributes exists
                    (event.data.previous_attributes as any).cancel_at_period_end === false
                ) {
                    const emailSent = await sendSubscriptionUpdatedEmail(user.email, previousPlanName, currentPlan.name);

                    if (emailSent) {
                        console.log(`[STRIPE HOOK] Subscription scheduled to cancel email sent to ${user.email}`);
                    } else {
                        console.error(`[STRIPE HOOK] Failed to send subscription scheduled to cancel email to ${user.email}`);
                    }
                } else {
                    console.log('[STRIPE HOOK] Ignoring subscription update: either cancel_at_period_end is not true, or it was not just set to true.');
                }
            } else {
                console.warn("[STRIPE HOOK] User plan not found, cannot send subscription updated email.");
            }

        } else {
            console.warn("[STRIPE HOOK] User email not found, cannot send subscription updated email.");
        }

    } catch (error) {
        console.error("[STRIPE HOOK] Error handling subscription updated:", error);
    }
}

async function handleSubscriptionPaused(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    if (typeof customerId !== 'string') {
        console.error(`[STRIPE HOOK] Customer ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
        return;
    }
    
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
        
        if (user && user.email) {
            const emailSent = await sendSubscriptionPausedEmail(user.email);
            if (emailSent) {
                console.log(`[STRIPE HOOK] Subscription paused email sent to ${user.email}`);
            } else {
                console.error(`[STRIPE HOOK] Failed to send subscription paused email to ${user.email}`);
            }
        } else {
            console.warn("[STRIPE HOOK] User email not found, cannot send paused subscription email.");
        }
    } catch (error) {
        console.error("[STRIPE HOOK] Error handling subscription pause:", error);
    }
}

// Handle subscription resume
async function handleSubscriptionResumed(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    if (typeof customerId !== 'string') {
        console.error(`[STRIPE HOOK] Customer ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
        return;
    }
    
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
            if (typeof proPlan._id === 'string') {
              user.planId = new Types.ObjectId(proPlan._id);
            } else {
              user.planId = new Types.ObjectId(proPlan._id.toString());
            }
        }
        
        user.updatedAt = new Date();
        await user.save();
        
        // Update Redis cache
        await redisClient.set(`user:${clerkId}`, JSON.stringify(user));
        
        console.log(`[STRIPE HOOK] Marked subscription as resumed for user ${clerkId}`);
        
        if (user && user.email) {
            const emailSent = await sendSubscriptionResumedEmail(user.email);
            if (emailSent) {
                console.log(`[STRIPE HOOK] Subscription resumed email sent to ${user.email}`);
            } else {
                console.error(`[STRIPE HOOK] Failed to send subscription resumed email to ${user.email}`);
            }
        } else {
            console.warn("[STRIPE HOOK] User email not found, cannot send resumed subscription email.");
        }
    } catch (error) {
        console.error("[STRIPE HOOK] Error handling subscription resume:", error);
    }
}

// Handle trial ending soon notification
async function handleTrialWillEnd(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    if (typeof customerId !== 'string') {
        console.error(`[STRIPE HOOK] Customer ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
        return;
    }
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
        
        if (user && user.email) {
            const trialEnd = subscription.trial_end!; // trial_end should be defined at this point
            const daysLeft = Math.ceil((trialEnd * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
            const emailSent = await sendTrialEndingSoonEmail(user.email, daysLeft);
            if (emailSent) {
                console.log(`[STRIPE HOOK] Trial ending soon email sent to ${user.email}`);
            } else {
                console.error(`[STRIPE HOOK] Failed to send trial ending soon email to ${user.email}`);
            }
        } else {
            console.warn("[STRIPE HOOK] User email not found, cannot send trial ending soon email.");
        }
    } catch (error) {
        console.error("[STRIPE HOOK] Error handling trial end notification:", error);
    }
}

// Handle invoice payment failure
async function handleInvoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;

    if (typeof customerId !== 'string') {
        console.error(`[STRIPE HOOK] Customer ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
        return;
    }

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

        if (user && user.email) {
            const emailSent = await sendPaymentFailedEmail(user.email);
            if (emailSent) {
                console.log(`[STRIPE HOOK] Payment failed email sent to ${user.email}`);
            } else {
                console.error(`[STRIPE HOOK] Failed to send payment failed email to ${user.email}`);
            }
        } else {
            console.warn("[STRIPE HOOK] User email not found, cannot send payment failed email.");
        }
    } catch (error) {
        console.error("[STRIPE HOOK] Error handling invoice payment failure:", error);
    }
}

// Handle invoice requiring payment action
async function handlePaymentActionRequired(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;

    if (typeof customerId !== 'string') {
        console.error(`[STRIPE HOOK] Customer ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
        return;
    }

    try {
        // Find user associated with this invoice
        const customer = await stripe.customers.retrieve(customerId);
        if (!isCustomerWithMetadata(customer)) {
            console.error("[STRIPE HOOK] Customer is deleted or missing userId in metadata:", customer);
            return;
        }

        const clerkId = customer.metadata.userId;
        const user = await UserModel.findOne({ clerkId });
        if(!user) {
            console.error("[STRIPE HOOK] User not found for clerkId:", clerkId);
            return;
        }

        console.log(`[STRIPE HOOK] Payment action required for user ${clerkId}, invoice ID: ${invoice.id}`);

        // TODO:  Implement logic to notify the user (e.g., email, in-app notification)
        //   about the required payment action.  Include a link to Stripe's secure
        //   payment page to complete the payment.

        // Example (replace with your notification logic):
        // await sendPaymentActionRequiredEmail(user.email, invoice.hosted_invoice_url);
        // console.log(`[STRIPE HOOK] Payment action required email sent to ${user.email}`);

    } catch (error) {
        console.error("[STRIPE HOOK] Error handling payment action required:", error);
    }
}

// Handle subscription deletion (cancellation)
async function handleSubscriptionDeleted(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    if (typeof customerId !== 'string') {
        console.error(`[STRIPE HOOK] Customer ID isn't string.\nEvent type: ${event.type}\nEvent data:`, event.data.object);
        return;
    }

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
        if (typeof freePlan._id === 'string') {
          user.planId = new Types.ObjectId(freePlan._id);
        } else {
          user.planId = new Types.ObjectId(freePlan._id.toString());
        }

        // Update subscription status
        if ('subscriptionStatus' in user) {
            user.subscriptionStatus = 'canceled';
        }

        // Reset the subscription ID if you've added that field
        if ('subscriptionId' in user) {
            user.subscriptionId = undefined;
        }

        // Reset cancelAtPeriodEnd flag
        if ('cancelAtPeriodEnd' in user) {
            user.cancelAtPeriodEnd = false;
        }

        user.updatedAt = new Date();
        await user.save();

        // Update Redis cache
        await redisClient.set(`user:${clerkId}`, JSON.stringify(user));

        console.log(`[STRIPE HOOK] Downgraded user ${clerkId} to Free plan after subscription ended`);

        if (user && user.email) {
            const emailSent = await sendSubscriptionCanceledEmail(user.email);
            if (emailSent) {
                console.log(`[STRIPE HOOK] Subscription canceled email sent to ${user.email}`);
            } else {
                console.error(`[STRIPE HOOK] Failed to send subscription canceled email to ${user.email}`);
            }
        } else {
            console.warn("[STRIPE HOOK] User email not found, cannot send subscription canceled email.");
        }
    } catch (error) {
        console.error("[STRIPE HOOK] Error handling subscription deletion:", error);
    }
}