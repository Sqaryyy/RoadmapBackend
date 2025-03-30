import { Request, Response } from 'express';
import { User } from '../interfaces/IUser';
import { UserModel } from '../models/User';

export interface ClerkRequest extends Request {
    auth: {
      userId: string;
      [key: string]: any;
    };
  }
// Helper function that can still be used directly if needed
export const checkAndResetMonthlyCounter = async (clerkId: string): Promise<User> => {
  console.log("checkAndResetMonthlyCounter called with clerkId:", clerkId);
    const user = await UserModel.findOne({ clerkId }); // Find by clerkId
    if (!user) {
      throw new Error('User not found');
    }
  
    const now = new Date();
    const lastReset = new Date(user.lastTopicCreationReset);
  
    // Check if it's a new month since the last reset
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      // Reset counter for the new month
      user.topicsCreatedThisMonth = 0;
      user.lastTopicCreationReset = now;
      await user.save();
    }
  
    return user;
  };

// Plan limits - you might want to move this to a config file or database
const PLAN_LIMITS: Record<string, number> = {
  'basic': 3,
  'premium': 10,

  'default': 3
};

export const canCreateTopic = async (req: ClerkRequest, res: Response): Promise<void> => {
    console.log("canCreateTopic called");
    try {
      const userId = req.auth?.userId;
      console.log("User ID from Clerk Auth:", userId);
  
      if (!userId) {
        console.log("User not authenticated");
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
  
      // Get user with populated plan
      console.log("Finding user by clerkId:", userId);
      const user = await UserModel.findOne({ clerkId: userId }).populate('planId'); // Find by clerkId
      console.log("User found:", user);
  
      if (!user) {
        console.log("User not found in database");
  
        // Fetch and log all users in the database for debugging
        const users = await UserModel.find();
        console.log("All Users in DB:", users);
  
        res.status(404).json({ error: 'User not found' });
        return;
      }
  
      // Check and reset monthly counter if needed
      await checkAndResetMonthlyCounter(userId);
  
      // Get the topic limit from the user's plan
      const plan = user.planId as any; // Using any because TypeScript doesn't know planId is populated
  
      // Default to 3 if no plan or topicsPerMonth is not set
      const limit = plan?.topicsPerMonth || PLAN_LIMITS.default;
      console.log("Plan Limit:", limit);
  
      // Special case: -1 means unlimited topics
      const canCreate = limit === -1 || user.topicsCreatedThisMonth < limit;
      console.log("Can Create Topic:", canCreate);
  
      // Prepare response object
      const response: any = {
        canCreate,
        topicsCreated: user.topicsCreatedThisMonth,
        limit: limit === -1 ? 'Unlimited' : limit,
      };
  
      // Add remaining count only for limited plans
      if (limit !== -1) {
        response.remaining = limit - user.topicsCreatedThisMonth;
      }
  
      console.log("Response:", response);
      res.json(response);
    } catch (error) {
      console.error('Error checking topic creation limit:', error);
      res.status(500).json({ error: 'Failed to check topic creation limit' });
    }
  };
  

  export const incrementTopicCounter = async (req: ClerkRequest, res: Response): Promise<void> => {
    console.log("incrementTopicCounter called");
    try {
      const userId = req.auth?.userId;
      console.log("User ID from Clerk Auth:", userId);

      if (!userId) {
        console.log("User not authenticated");
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
  
      console.log("Incrementing topic counter for clerkId:", userId);
      await UserModel.findOneAndUpdate({ clerkId: userId }, {  // Find and Update by clerkId
        $inc: { topicsCreatedThisMonth: 1 }
      });
  
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error incrementing topic counter:', error);
      res.status(500).json({ error: 'Failed to increment topic counter' });
    }
  };

  import { ClerkRequest, ClerkExpressWithAuth } from '@clerk/clerk-sdk/dist/types/express';
  import { Response } from 'express';
  import { UserModel, User } from '../models/user.model';
  import { PLAN_LIMITS } from '../utils/constants';
  
  export const checkAndResetMonthlySkillCounter = async (clerkId: string): Promise<User> => {
      console.log("checkAndResetMonthlySkillCounter called with clerkId:", clerkId);
      const user = await UserModel.findOne({ clerkId });
    
      if (!user) {
        console.log("User not found for clerkId:", clerkId); //Added Debug Log
        throw new Error('User not found');
      }
    
      const now = new Date();
      const lastReset = new Date(user.lastSkillAdditionReset || 0);
  
      console.log("Current date:", now); //Added Debug Log
      console.log("Last reset date:", lastReset); //Added Debug Log
    
      if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        console.log("Monthly skill counter needs to be reset for user:", clerkId); //Added Debug Log
        user.skillsAddedThisMonth = 0;
        user.lastSkillAdditionReset = now;
        await user.save();
        console.log("Monthly skill counter reset for user:", clerkId, "New values:", {
          skillsAddedThisMonth: user.skillsAddedThisMonth,
          lastSkillAdditionReset: user.lastSkillAdditionReset
        }); //Added Debug Log
  
      } else {
          console.log("Monthly skill counter does not need to be reset for user:", clerkId); //Added Debug Log
      }
    
      return user;
    };
    
    export const canAddSkill = async (req: ClerkRequest, res: Response): Promise<void> => {
      console.log("canAddSkill called");
    
      try {
        const userId = req.auth?.userId;
        console.log("User ID from request:", userId); //Added Debug Log
  
        if (!userId) {
          console.log("User not authenticated"); //Added Debug Log
          res.status(401).json({ error: 'User not authenticated' });
          return;
        }
    
        const user = await UserModel.findOne({ clerkId: userId }).populate('planId');
        if (!user) {
          console.log("User not found in database for clerkId:", userId); //Added Debug Log
          res.status(404).json({ error: 'User not found' });
          return;
        }
  
        console.log("User found:", user); //Added Debug Log
    
        await checkAndResetMonthlySkillCounter(userId);
    
        const plan = user.planId as any;
        const skillLimit = plan?.maxSkills || PLAN_LIMITS.default;
  
        console.log("User's plan:", plan); //Added Debug Log
        console.log("Skill limit:", skillLimit); //Added Debug Log
    
        const canAdd = skillLimit === -1 || user.skillsAddedThisMonth < skillLimit;
  
        console.log("Can add skill:", canAdd); //Added Debug Log
    
        res.json({
          canAdd,
          skillsAdded: user.skillsAddedThisMonth,
          limit: skillLimit === -1 ? 'Unlimited' : skillLimit,
          remaining: skillLimit !== -1 ? skillLimit - user.skillsAddedThisMonth : 'Unlimited',
        });
    
      } catch (error) {
        console.error('Error checking skill addition limit:', error);
        res.status(500).json({ error: 'Failed to check skill addition limit' });
      }
    };
  
  export const incrementSkillCounter = async (req: ClerkRequest, res: Response): Promise<void> => {
    console.log("incrementSkillCounter called");
  
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
  
      await UserModel.findOneAndUpdate(
        { clerkId: userId },
        { $inc: { skillsAddedThisMonth: 1 } }
      );
  
      res.status(200).json({ success: true });
  
    } catch (error) {
      console.error('Error incrementing skill counter:', error);
      res.status(500).json({ error: 'Failed to increment skill counter' });
    }
  };
  