// src/controllers/subscriptionController.ts
import { Response } from 'express';
import { startProPlanTrial, cancelSubscription } from '../utils/stripe-utils';
import { UserModel } from '../models/User';
import { ClerkRequest } from '../utils/userLimits';

export async function startProTrial(req: ClerkRequest, res: Response) {
  try {
    const clerkId = req.auth?.userId; // Clerk provides userId as the clerkId

    if (!clerkId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User ID not found in auth context.' });
    }

    const user = await UserModel.findOne({ clerkId: clerkId }); // Find by clerkId
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user already has an active subscription
    if (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') {
      return res.status(400).json({
        success: false,
        message: 'User already has an active subscription or trial'
      });
    }

    const success = await startProPlanTrial(clerkId, user.email);

    if (success) {
      return res.status(200).json({
        success: true,
        message: 'Pro plan trial started successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to start Pro plan trial'
      });
    }
  } catch (error) {
    console.error('Error in startProTrial controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}

export async function cancelUserSubscription(req: ClerkRequest, res: Response) {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User ID not found in auth context.' });
    }

    const user = await UserModel.findOne({ clerkId: userId }); 
    if (!user || !user.subscriptionId) {
      return res.status(404).json({
        success: false,
        message: 'User or subscription not found'
      });
    }

    const success = await cancelSubscription(user.subscriptionId);

    if (success) {
      return res.status(200).json({
        success: true,
        message: 'Subscription cancelled successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to cancel subscription'
      });
    }
  } catch (error) {
    console.error('Error in cancelSubscription controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}