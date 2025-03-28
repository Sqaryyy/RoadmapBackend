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
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true }, // Reference the Plan model
    topicsCreatedThisMonth: { type: Number, default: 0 }, // Tracks topics viewed this month.
    lastTopicCreationReset: { type: Date, default: Date.now }, // When the topic view count was last reset.
});

export const UserModel = mongoose.model<User>('User', userSchema);