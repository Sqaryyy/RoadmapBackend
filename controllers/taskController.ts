// taskController.ts
import { Request, Response } from 'express';
import { TaskModel } from '../models/Task';
import { Task } from '../interfaces/ITask';

// Create Task
export const createTask = async (req: Request, res: Response) => {
    try {
        const newTask: Task = req.body;
        const task = new TaskModel(newTask);
        const savedTask = await task.save();
        res.status(201).json(savedTask);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Get Task by ID
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

// Get tasks for a topic
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
export const updateTask = async (req: Request, res: Response) => {
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
};

// Delete Task
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