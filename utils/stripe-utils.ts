// backend/utils/stripe-utils.ts
import dotenv from 'dotenv';
import Stripe from 'stripe';
import Redis from 'ioredis';
import { UserModel } from '../models/User';
import { PlanModel } from '../models/Plan';

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const redisClient = new Redis(process.env.REDIS_URL!); // Ensure REDIS_URL is set

export type STRIPE_SUB_CACHE =
  | {
      subscriptionId: string | null;
      status: Stripe.Subscription.Status;
      priceId: string | null;
      currentPeriodStart: number | null;
      currentPeriodEnd: number | null;
      cancelAtPeriodEnd: boolean;
      paymentMethod: {
        brand: string | null; // e.g., "visa", "mastercard"
        last4: string | null; // e.g., "4242"
      } | null;
    }
  | {
      status: "none";
    };

async function syncStripeDataToKV(customerId: string): Promise<STRIPE_SUB_CACHE> {
  try {
    // Fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: "all",
      expand: ["data.default_payment_method"],
    });

    if (subscriptions.data.length === 0) {
      const subData: STRIPE_SUB_CACHE = { status: "none" };
      await redisClient.set(`stripe:customer:${customerId}`, JSON.stringify(subData));
      return subData;
    }

    // If a user can have multiple subscriptions, that's your problem
    const subscription = subscriptions.data[0];

    // Store complete subscription state
    const subData: STRIPE_SUB_CACHE = {
      subscriptionId: subscription.id,
      status: subscription.status,
      priceId: subscription.items.data[0].price.id,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      paymentMethod:
        subscription.default_payment_method &&
        typeof subscription.default_payment_method !== "string"
          ? {
              brand: subscription.default_payment_method.card?.brand ?? null,
              last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : null,
    };

    // Store the data in your KV (Redis)
    await redisClient.set(`stripe:customer:${customerId}`, JSON.stringify(subData));
    return subData;
  } catch (error) {
    console.error("Error in syncStripeDataToKV:", error);
    return { status: "none" } as STRIPE_SUB_CACHE;
    // Consider throwing the error or returning a default value based on your needs
  }
}

export async function startProPlanTrial(userId: string, email: string): Promise<boolean> {
  try {
    // Find the Pro plan to get the Stripe Price ID
    const proPlan = await PlanModel.findOne({ name: 'Pro' });
    if (!proPlan || !proPlan.stripePriceId) {
      throw new Error('Pro plan not found or missing Stripe Price ID');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Create or retrieve a Stripe customer
    let customerId = user.stripeCustomerId;
    
    if (!customerId) {
      // Create a new customer in Stripe
      const customer = await stripe.customers.create({
        email: email,
        metadata: {
          userId: userId
        }
      });
      
      customerId = customer.id;
      
      // Save the Stripe customer ID to the user
      user.stripeCustomerId = customerId;
      await user.save();
    }

    // Create a subscription with a trial period
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: proPlan.stripePriceId }],
      trial_period_days: 7,
      metadata: {
        userId: userId
      }
    });

    // Add a null check for trial_end
    const trialEndDate = subscription.trial_end 
    ? new Date(subscription.trial_end * 1000) 
    : new Date(subscription.current_period_end * 1000); // Fallback to period end
    
    await UserModel.findByIdAndUpdate(userId, {
      planId: proPlan._id,
      subscriptionStatus: 'trialing',
      subscriptionId: subscription.id,
      trialEndDate: trialEndDate,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    });

    return true;
  } catch (error) {
    console.error('Error starting Pro plan trial with Stripe:', error);
    return false;
  }
}

export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    return true;
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return false;
  }
}

export { syncStripeDataToKV };