import { Request, Response } from 'express';
import { TopicModel } from '../models/Topic';
import { Topic } from '../interfaces/ITopic';
import { TaskModel } from '../models/Task';
import { body, validationResult } from 'express-validator';

// Create Topic
export const createTopic = [
    body('title').isString().withMessage('Title must be a string').trim().notEmpty().withMessage('Title is required'),
    body('description').isString().withMessage('Description must be a string').trim().notEmpty().withMessage('Description is required'),
    body('skillId').isString().withMessage('skillId must be a string').trim().notEmpty().withMessage('skillId is required'),
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const newTopic: Topic = req.body;
            const topic = new TopicModel(newTopic);
            const savedTopic = await topic.save();
            res.status(201).json(savedTopic);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    }
];

// Get Topic by ID - No validation needed on the ID itself, as Mongoose handles invalid IDs

export const getTopicById = async (req: Request, res: Response) => {
    try {
        // Fetch topic WITHOUT tasks populated
        const topic = await TopicModel.findById(req.params.id).populate('skillId');
        if (!topic) {
            return res.status(404).json({ message: 'Topic not found' });
        }

        // Fetch tasks separately based on topicId
        const tasks = await TaskModel.find({ topicId: req.params.id });

        // Merge tasks into response manually
        res.status(200).json({ ...topic.toObject(), tasks });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};


// Get topics for a skill - no validation needed

export const getTopicsBySkillId = async (req: Request, res: Response) => {
    try {
        const topics = await TopicModel.find({ skillId: req.params.skillId }).populate('tasks');
        res.status(200).json(topics);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Update Topic
export const updateTopic = [
    body('title').optional().isString().withMessage('Title must be a string').trim(),
    body('description').optional().isString().withMessage('Description must be a string').trim(),
    body('skillId').optional().isString().withMessage('skillId must be a string').trim(),
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const updatedTopic = await TopicModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!updatedTopic) {
                return res.status(404).json({ message: 'Topic not found' });
            }
            res.status(200).json(updatedTopic);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    }
];

// Delete Topic - No validation needed

export const deleteTopic = async (req: Request, res: Response) => {
    try {
        const deletedTopic = await TopicModel.findByIdAndDelete(req.params.id);
        if (!deletedTopic) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        res.status(200).json({ message: 'Topic deleted' });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};