// taskModel.ts
import { Task, Difficulty } from "../interfaces/ITask"; // Import Difficulty
import { Schema } from "mongoose";
import mongoose from "mongoose";

export const taskSchema: Schema<Task> = new Schema({
    topicId: { type: Schema.Types.ObjectId, required: true, ref: 'Topic' }, // Use Schema.Types.ObjectId
    name: { type: String, required: true },
    completionCriteria: { type: String },
    estimatedTime: { type: String },
    instructions: { type: String },
    objective: { type: String },
    resources: [{ type: String }],
    isCompleted: { type: Boolean, default: false }, // Added isCompleted field with default value
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'], // Restrict values to 'easy', 'medium', 'hard'
        required: true //  Make difficulty required
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

export const TaskModel = mongoose.model<Task>('Task', taskSchema);