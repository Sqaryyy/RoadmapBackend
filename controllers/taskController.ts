// taskController.ts
import { Request, Response } from 'express';
import { TaskModel } from '../models/Task';
import { Task } from '../interfaces/ITask';
import { body, validationResult } from 'express-validator';

// Create Task
export const createTask = [
    body('title').isString().withMessage('Title must be a string').trim().notEmpty().withMessage('Title is required'),
    body('description').isString().withMessage('Description must be a string').trim().notEmpty().withMessage('Description is required'),
    body('topicId').isString().withMessage('topicId must be a string').trim().notEmpty().withMessage('topicId is required'),
    body('type').isString().withMessage('type must be a string').trim().notEmpty().withMessage('type is required'),
    body('content').isString().withMessage('content must be a string').trim().notEmpty().withMessage('content is required'),
    body('order').isInt().withMessage('order must be an integer'),
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
    body('title').optional().isString().withMessage('Title must be a string').trim(),
    body('description').optional().isString().withMessage('Description must be a string').trim(),
    body('topicId').optional().isString().withMessage('topicId must be a string').trim(),
    body('type').optional().isString().withMessage('type must be a string').trim(),
    body('content').optional().isString().withMessage('content must be a string').trim(),
    body('order').optional().isInt().withMessage('order must be an integer'),
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