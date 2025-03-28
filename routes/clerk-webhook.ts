import express, { Request, Response, Router } from 'express';
import { Webhook, WebhookRequiredHeaders } from 'svix';
import { UserModel } from '../models/User';
import { PlanModel } from '../models/Plan'; // Import the PlanModel!
import mongoose from 'mongoose';

const router: Router = express.Router();

interface WebhookEvent {
    type: string;
    data: {
        id: string;
        email_addresses?: Array<{ email_address: string }>;
        first_name?: string;
        last_name?: string;
        image_url?: string;
    };
}

router.post('/', async (req: Request, res: Response) => {
    const svixId = req.headers['svix-id'] as string;
    const svixTimestamp = req.headers['svix-timestamp'] as string;
    const svixSignature = req.headers['svix-signature'] as string;

    if (!svixId || !svixTimestamp || !svixSignature) {
        return res.status(400).json({ error: 'Missing Svix headers' });
    }

    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const wh = new Webhook(webhookSecret);
    let payload: WebhookEvent;

    try {
        payload = wh.verify(
            JSON.stringify(req.body),
            {
                'svix-id': svixId,
                'svix-timestamp': svixTimestamp,
                'svix-signature': svixSignature,
            } as WebhookRequiredHeaders
        ) as WebhookEvent;
    } catch (err) {
        console.error('🚨 Webhook verification failed:', err);
        return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const { type, data } = payload;

    try {
        if (type === 'user.created') {
            const existingUser = await UserModel.findOne({ clerkId: data.id });

            // 1. Get the Free plan from the database
            const freePlan = await PlanModel.findOne({ name: 'Free' });

            if (!freePlan) {
                console.error('Free plan not found in database.  Make sure you have seeded the database!');
                return res.status(500).json({ error: 'Free plan not found' }); // Critical: Return an error
            }

            // 2. Determine the correct planId to use. Start with the Free plan.
            let planId: string | mongoose.Types.ObjectId; // Define the type of planId

            //Correct implementation, freePlan._id is guarenteed to be an object ID
            if (freePlan._id instanceof mongoose.Types.ObjectId){
                planId = freePlan._id;
            } else {
                console.error(`Invalid plan ID. Free plan id is not an object id`);
                return res.status(500).json({error: `Invalid Plan ID`})
            }

            // 3. Override if the user has a specific planId in Clerk metadata
            try {
                // Extract planId from the unsafeMetadata if available
                const clerkResponse = await fetch(`https://api.clerk.dev/v1/users/${data.id}`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (clerkResponse.ok) {
                    const userData = await clerkResponse.json();
                    if (userData.unsafe_metadata && userData.unsafe_metadata.planId) {
                        const clerkPlanId = userData.unsafe_metadata.planId; // clerkPlanId is string

                        const planExists = await PlanModel.exists({ _id: clerkPlanId });
                        if (planExists) {
                            planId = clerkPlanId; // Override with Clerk's planId
                        }
                        else {
                            console.warn(`Plan ID ${clerkPlanId} from clerk does not exist in database. User will be assigned Free plan`)
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching user metadata from Clerk:', error);
            }

            if (existingUser) {
                console.log('🔄 User already exists:', data.id);
                // Update existing user with plan if needed
                if (existingUser.planId.toString() !== planId.toString()) { // Compare as strings
                    existingUser.planId = planId;
                    await existingUser.save();
                    console.log(`✅ User ${data.id} plan updated to ${planId}`);
                }
            } else {
                const newUser = new UserModel({
                    clerkId: data.id,
                    email: data.email_addresses?.[0]?.email_address,
                    firstName: data.first_name,
                    lastName: data.last_name,
                    imageUrl: data.image_url,
                    planId: planId, // Use the fetched plan ID here!
                });

                await newUser.save();
                console.log('✅ User saved to DB with plan:', planId);
            }
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        return res.status(500).json({ error: 'Error processing webhook' });
    }
});

export default router;