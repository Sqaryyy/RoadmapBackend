// backend/utils/stripe-utils.ts
import dotenv from 'dotenv';
import Stripe from 'stripe';
import Redis from 'ioredis';


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

export { syncStripeDataToKV };