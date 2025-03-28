import { Types } from 'mongoose';

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
    createdAt?: Date;
    updatedAt?: Date;
  }