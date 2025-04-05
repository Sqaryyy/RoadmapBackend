// src/models/Plan.ts
import { Schema } from 'mongoose';
import { Plan } from '../interfaces/IPlan';
import mongoose from 'mongoose';

export const planSchema: Schema<Plan> = new Schema({
    name: { type: String, required: true, unique: true }, // "Free", "Pro"
    price: { type: Number, default: 0 }, // Monthly price (0 for Free)
    currency: { type: String, default: 'GBP' }, // Currency (optional)
    maxSkills: { type: Number, default: 1 }, // Maximum skills (1 for Free, -1 for unlimited)
    topicsPerMonth: { type: Number, default: 3 }, // Topics created per month (3 for Free, -1 for unlimited)
    stripePriceId: { type: String, required: false, default: null}, // Stripe Price ID (for paid plans)
});

export const PlanModel = mongoose.model<Plan>('Plan', planSchema);