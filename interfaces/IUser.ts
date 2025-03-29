import { Types, Document } from 'mongoose';

export interface User extends Document {
    clerkId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
    createdAt?: Date;
    updatedAt?: Date;

    // Skills tracking
    skills: Types.ObjectId[];
    skillsAddedThisMonth: number;  // Track skills added this month
    lastSkillAdditionReset: Date;  // Last reset date for skill tracking

    // Subscription tracking
    planId: Types.ObjectId | string;  
    topicsCreatedThisMonth: number;
    lastTopicCreationReset: Date;
}
