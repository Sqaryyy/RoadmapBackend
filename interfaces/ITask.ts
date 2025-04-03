import { Types } from 'mongoose';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Task {
    _id: Types.ObjectId;
    topicId: Types.ObjectId; // Reference to Topic
    name: string;
    completionCriteria: string;
    estimatedTime: string;
    instructions: string;
    objective: string;
    resources: string[];
    isCompleted: boolean; // Added completed status
    difficulty: Difficulty; // Added difficulty level
    createdAt?: Date;
    updatedAt?: Date;
  }