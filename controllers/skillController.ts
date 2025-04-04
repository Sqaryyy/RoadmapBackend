import { Request, Response } from 'express';
import { SkillModel } from '../models/Skill';
import { Skill } from '../interfaces/ISkill';
import { body, validationResult } from 'express-validator';

// Create Skill
export const createSkill = [
    body('title').isString().withMessage('Title must be a string').trim().notEmpty().withMessage('Title is required'),
    body('description').isString().withMessage('Description must be a string').trim().notEmpty().withMessage('Description is required'),
    body('userId').isString().withMessage('userId must be a string').trim().notEmpty().withMessage('userId is required'),
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const newSkill: Skill = req.body;
            const skill = new SkillModel(newSkill);
            const savedSkill = await skill.save();
            res.status(201).json(savedSkill);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    }
];

// Get Skill by ID - No validation needed on the ID itself, as Mongoose handles invalid IDs
export const getSkillById = async (req: Request, res: Response) => {
    try {
        const skill = await SkillModel.findById(req.params.id).populate('coveredTopics').populate('activeTopic');
        if (!skill) {
            return res.status(404).json({ message: 'Skill not found' });
        }
        res.status(200).json(skill);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Get all skills for a user - No validation needed, as Mongoose handles invalid IDs and non-existent users.
export const getSkillsByUserId = async (req: Request, res: Response) => {
    try {
        const skills = await SkillModel.find({ userId: req.params.userId }).populate('coveredTopics').populate('activeTopic');
        res.status(200).json(skills);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Update Skill
export const updateSkill = [
    body('title').optional().isString().withMessage('Title must be a string').trim(),
    body('description').optional().isString().withMessage('Description must be a string').trim(),
    body('userId').optional().isString().withMessage('userId must be a string').trim(),
    body('isCompleted').optional().isBoolean().withMessage('isCompleted must be a boolean'),
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const updatedSkill = await SkillModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!updatedSkill) {
                return res.status(404).json({ message: 'Skill not found' });
            }
            res.status(200).json(updatedSkill);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    }
];

// Delete Skill - No validation needed, as Mongoose handles invalid IDs and non-existent users.
export const deleteSkill = async (req: Request, res: Response) => {
    try {
        const deletedSkill = await SkillModel.findByIdAndDelete(req.params.id);
        if (!deletedSkill) {
            return res.status(404).json({ message: 'Skill not found' });
        }
        res.status(200).json({ message: 'Skill deleted' });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Mark Skill as Completed - No body data, so no body validation needed.
export const markSkillAsCompleted = async (req: Request, res: Response) => {
    try {
        const skill = await SkillModel.findByIdAndUpdate(
            req.params.id,
            { isCompleted: true, updatedAt: Date.now() }, // Update the completion status
            { new: true } // Return the updated skill
        );

        if (!skill) {
            return res.status(404).json({ message: 'Skill not found' });
        }

        res.status(200).json(skill);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Mark Skill as Incomplete - No body data, so no body validation needed.
export const markSkillAsIncomplete = async (req: Request, res: Response) => {
    try {
        const skill = await SkillModel.findByIdAndUpdate(
            req.params.id,
            { isCompleted: false, updatedAt: Date.now() }, // Update the completion status and update timestamp
            { new: true } // Return the updated skill
        );

        if (!skill) {
            return res.status(404).json({ message: 'Skill not found' });
        }

        res.status(200).json(skill);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};