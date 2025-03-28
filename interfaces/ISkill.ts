import { Types } from 'mongoose';

export interface Skill {
    _id: Types.ObjectId;
    userId: string;
    name: string;
    coveredTopics: Types.ObjectId[]; // Array of Topic ObjectIds
    activeTopic?: Types.ObjectId | null; // Reference to Topic or null
    preferredLearningStyle: string;
    currentSkillLevel: string;
    goal: string;
    availableTimePerWeek: string;
    createdAt?: Date;
    updatedAt?: Date;
  }