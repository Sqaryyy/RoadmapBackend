// src/interfaces/ITopic.ts (Modify this file)
import { Types } from 'mongoose';

export interface Topic {
    _id: Types.ObjectId;
    skillId: Types.ObjectId; // Reference to Skill
    name: string;
    tasks: Types.ObjectId[]; // Array of Task ObjectIds
    recommendedResources: string[];
    learningObjectives: string[];
    createdAt?: Date;
    updatedAt?: Date;
  }