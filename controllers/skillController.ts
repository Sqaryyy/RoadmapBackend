import { Request, Response } from 'express';
import { SkillModel } from '../models/Skill';
import { Skill } from '../interfaces/ISkill';

// Create Skill
export const createSkill = async (req: Request, res: Response) => {
    try {
        const newSkill: Skill = req.body;
        const skill = new SkillModel(newSkill);
        const savedSkill = await skill.save();
        res.status(201).json(savedSkill);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Get Skill by ID
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

// Get all skills for a user
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
export const updateSkill = async (req: Request, res: Response) => {
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
};

// Delete Skill
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

// Mark Skill as Completed
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
