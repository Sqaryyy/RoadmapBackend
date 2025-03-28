import { Request, Response } from 'express';
import { TopicModel } from '../models/Topic';
import { Topic } from '../interfaces/ITopic';

// Create Topic
export const createTopic = async (req: Request, res: Response) => {
    try {
        const newTopic: Topic = req.body;
        const topic = new TopicModel(newTopic);
        const savedTopic = await topic.save();
        res.status(201).json(savedTopic);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Get Topic by ID
export const getTopicById = async (req: Request, res: Response) => {
    try {
        const topic = await TopicModel.findById(req.params.id).populate('tasks').populate('skillId');
        if (!topic) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        res.status(200).json(topic);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Get topics for a skill
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
export const updateTopic = async (req: Request, res: Response) => {
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
};

// Delete Topic
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