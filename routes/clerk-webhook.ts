import express, { Request, Response, Router } from 'express';
import { Webhook, WebhookRequiredHeaders } from 'svix';
import { UserModel } from '../models/User';
import { PlanModel } from '../models/Plan';
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
                console.error('Free plan not found in database. Make sure you have seeded the database!');
                return res.status(500).json({ error: 'Free plan not found' }); 
            }

            // 2. Determine the correct planId to use. Start with the Free plan.
            let planId: string | mongoose.Types.ObjectId; // Define the type of planId

            // Correct implementation, freePlan._id is guaranteed to be an object ID
            if (freePlan._id instanceof mongoose.Types.ObjectId) {
                planId = freePlan._id;
            } else {
                console.error(`Invalid plan ID. Free plan id is not an object id`);
                return res.status(500).json({ error: `Invalid Plan ID` });
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
                            console.warn(`Plan ID ${clerkPlanId} from clerk does not exist in database. User will be assigned Free plan`);
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
        else if (type === 'user.updated') {
            // Find the user by clerkId
            const user = await UserModel.findOne({ clerkId: data.id });
            
            if (!user) {
                console.log('⚠️ User not found for update:', data.id);
                return res.status(200).json({ success: true }); // Return 200 to acknowledge receipt
            }
            
            // Update user fields if they exist in the payload
            if (data.email_addresses && data.email_addresses[0]) {
                user.email = data.email_addresses[0].email_address;
            }
            
            if (data.first_name !== undefined) {
                user.firstName = data.first_name;
            }
            
            if (data.last_name !== undefined) {
                user.lastName = data.last_name;
            }
            
            if (data.image_url !== undefined) {
                user.imageUrl = data.image_url;
            }
            
            // Check for plan updates in Clerk metadata
            try {
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
                        const clerkPlanId = userData.unsafe_metadata.planId;
                        
                        // Verify the plan exists in our database
                        const planExists = await PlanModel.exists({ _id: clerkPlanId });
                        if (planExists && user.planId.toString() !== clerkPlanId) {
                            user.planId = clerkPlanId;
                            console.log(`✅ User ${data.id} plan updated to ${clerkPlanId}`);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching user metadata from Clerk:', error);
            }
            
            await user.save();
            console.log('✅ User updated in DB:', data.id);
        }
        else if (type === 'user.deleted') {
            // Find and delete the user from our database
            const result = await UserModel.deleteOne({ clerkId: data.id });
            
            if (result.deletedCount === 0) {
                console.log('⚠️ User not found for deletion:', data.id);
            } else {
                console.log('✅ User deleted from DB:', data.id);
            }
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        return res.status(500).json({ error: 'Error processing webhook' });
    }
});

export default router;