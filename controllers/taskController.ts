import { Request, Response } from 'express';
import { TaskModel } from '../models/Task';
import { Task } from '../interfaces/ITask';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';

// Create Task
export const createTask = [
    body('name').isString().withMessage('Name must be a string').trim().notEmpty().withMessage('Name is required'),
    body('topicId').isString().withMessage('topicId must be a string').trim().notEmpty().withMessage('topicId is required').custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
            throw new Error('Invalid topicId');
        }
        return true;
    }),
    body('completionCriteria').optional().isString().withMessage('completionCriteria must be a string').trim(),
    body('estimatedTime').optional().isString().withMessage('estimatedTime must be a string').trim(),
    body('instructions').optional().isString().withMessage('instructions must be a string').trim(),
    body('objective').optional().isString().withMessage('objective must be a string').trim(),
    body('resources').optional().isArray().withMessage('resources must be an array of strings'),
    body('resources.*').optional().isString().withMessage('Each resource must be a string'),
    body('isCompleted').optional().isBoolean().withMessage('isCompleted must be a boolean'),
    body('difficulty').isString().withMessage('Difficulty must be a string').trim().notEmpty().withMessage('Difficulty is required').isIn(['easy', 'medium', 'hard']).withMessage('Difficulty must be one of: easy, medium, hard'),
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const newTask: Task = req.body;
            const task = new TaskModel(newTask);
            const savedTask = await task.save();
            res.status(201).json(savedTask);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    }
];

// Get Task by ID - No validation needed on the ID itself, as Mongoose handles invalid IDs

export const getTaskById = async (req: Request, res: Response) => {
    try {
        const task = await TaskModel.findById(req.params.id).populate('topicId');
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.status(200).json(task);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};


// Get tasks for a topic - no validation needed

export const getTasksByTopicId = async (req: Request, res: Response) => {
    try {
        const tasks = await TaskModel.find({ topicId: req.params.topicId });
        res.status(200).json(tasks);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Update Task
export const updateTask = [
    body('name').optional().isString().withMessage('Name must be a string').trim(),
    body('topicId').optional().isString().withMessage('topicId must be a string').trim().custom((value) => {
        if (value && !mongoose.Types.ObjectId.isValid(value)) {
            throw new Error('Invalid topicId');
        }
        return true;
    }),
    body('completionCriteria').optional().isString().withMessage('completionCriteria must be a string').trim(),
    body('estimatedTime').optional().isString().withMessage('estimatedTime must be a string').trim(),
    body('instructions').optional().isString().withMessage('instructions must be a string').trim(),
    body('objective').optional().isString().withMessage('objective must be a string').trim(),
    body('resources').optional().isArray().withMessage('resources must be an array of strings'),
    body('resources.*').optional().isString().withMessage('Each resource must be a string'),
    body('isCompleted').optional().isBoolean().withMessage('isCompleted must be a boolean'),
    body('difficulty').optional().isString().withMessage('Difficulty must be a string').trim().isIn(['easy', 'medium', 'hard']).withMessage('Difficulty must be one of: easy, medium, hard'),
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const updatedTask = await TaskModel.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true, runValidators: true } // Added runValidators
            );
            if (!updatedTask) {
                return res.status(404).json({ message: 'Task not found' });
            }
            res.status(200).json(updatedTask);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    }
];

// Delete Task - No validation needed

export const deleteTask = async (req: Request, res: Response) => {
    try {
        const deletedTask = await TaskModel.findByIdAndDelete(req.params.id);
        if (!deletedTask) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.status(200).json({ message: 'Task deleted' });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};