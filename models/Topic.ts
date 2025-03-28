// src/models/Topic.ts (Modify this file)
import { Schema } from 'mongoose';
import { Topic } from '../interfaces/ITopic';
import mongoose from 'mongoose';

export const topicSchema: Schema<Topic> = new Schema({
    skillId: { type: Schema.Types.ObjectId, required: true, ref: 'Skill' }, // Use Schema.Types.ObjectId
    name: { type: String, required: true },
    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }], // Use Schema.Types.ObjectId
    recommendedResources: [{ type: String }],
    learningObjectives: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

export const TopicModel = mongoose.model<Topic>('Topic', topicSchema);