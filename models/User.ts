// src/models/User.ts
import{ Schema } from 'mongoose';
import { User } from '../interfaces/IUser';
import mongoose from 'mongoose';

// User Schema
export const userSchema: Schema<User> = new Schema({
    clerkId: { type: String, required: true, unique: true }, // Clerk User ID
    email: { type: String, required: true, unique: true },
    firstName: { type: String }, // Optional first name
    lastName: { type: String },  // Optional last name
    imageUrl: { type: String },  // Optional image URL
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    skills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }], // Use Schema.Types.ObjectId
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true }, 
    topicsCreatedThisMonth: { type: Number, default: 0 }, 
    lastTopicCreationReset: { type: Date, default: Date.now },
    skillsAddedThisMonth: { type: Number, default: 0 }, // Skills added per month
    lastSkillAdditionReset: { type: Date, default: Date.now }, // Reset date for skills
    stripeCustomerId: { type: String },
    subscriptionStatus: { type: String, enum: ['active', 'paused', 'cancelling','canceled', 'trialing', 'past_due', 'none'], default: 'none' },
    subscriptionId: { type: String },
    currentPeriodEnd: { type: Date },
    trialEndDate: { type: Date },
    paymentIssue: { type: Boolean, default: false },
    lastFailedPayment: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false }
});

export const UserModel = mongoose.model<User>('User', userSchema);