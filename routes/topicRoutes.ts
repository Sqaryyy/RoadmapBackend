// topicRoutes.ts
import express from 'express';
import { createTopic, getTopicById, getTopicsBySkillId, updateTopic, deleteTopic } from '../controllers/topicController';
import { requireAuth } from '@clerk/express'

const router = express.Router();

router.post('/',requireAuth(), createTopic);
router.get('/:id',requireAuth(), getTopicById);
router.get('/skill/:skillId',requireAuth(), getTopicsBySkillId);
router.put('/:id',requireAuth(), updateTopic);
router.delete('/:id',requireAuth(), deleteTopic);

export default router;