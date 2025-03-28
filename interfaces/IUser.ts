import { Types } from 'mongoose';

export interface User extends Document {
    clerkId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
    createdAt?: Date;
    updatedAt?: Date;
    skills: Types.ObjectId[];
    planId: Types.ObjectId | string;  // Changed to ObjectId or string
    topicsCreatedThisMonth: number;
    lastTopicCreationReset: Date;
}