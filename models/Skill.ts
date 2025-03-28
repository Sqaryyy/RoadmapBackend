// src/models/Skill.ts
import { Schema } from 'mongoose';
import { Skill } from '../interfaces/ISkill';
import mongoose from 'mongoose';

export const skillSchema: Schema<Skill> = new Schema({
    userId: { type: String, required: true, ref: 'User',  }, // Use Schema.Types.ObjectId
    name: { type: String, required: true },
    coveredTopics: [{ type: Schema.Types.ObjectId, ref: 'Topic' }], // Use Schema.Types.ObjectId
    activeTopic: { type: Schema.Types.ObjectId, ref: 'Topic', default: null }, // Use Schema.Types.ObjectId
    preferredLearningStyle: { type: String },
    currentSkillLevel: { type: String },
    goal: { type: String },
    availableTimePerWeek: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

export const SkillModel = mongoose.model<Skill>('Skill', skillSchema);