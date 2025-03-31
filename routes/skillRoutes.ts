// skillRoutes.ts
import express from 'express';
import { createSkill, getSkillById, getSkillsByUserId, updateSkill,deleteSkill,markSkillAsCompleted,markSkillAsIncomplete } from '../controllers/skillController';
import { requireAuth } from '@clerk/express'

const router = express.Router();

router.post('/',requireAuth(), createSkill);
router.get('/:id',requireAuth(), getSkillById);
router.get('/user/:userId',requireAuth(), getSkillsByUserId);
router.put('/:id',requireAuth(), updateSkill);
router.delete('/:id',requireAuth(), deleteSkill);
router.patch('/:id/complete', markSkillAsCompleted);
router.patch('/:id/incomplete', markSkillAsIncomplete);


export default router;