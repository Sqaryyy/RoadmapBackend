// src/interfaces/IPlan.ts
import { Document } from 'mongoose';

export interface Plan extends Document {
    name: string;
    price: number;
    currency: string;
    maxSkills: number;
    topicsPerMonth: number;
    stripePriceId?: string | null;
    features: string[];
}