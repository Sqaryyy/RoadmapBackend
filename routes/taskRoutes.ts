// taskRoutes.ts
import express from 'express';
import { createTask, getTaskById, getTasksByTopicId, updateTask, deleteTask } from '../controllers/taskController';
import { requireAuth } from '@clerk/express'

const router = express.Router();

router.post('/',requireAuth(), createTask);
router.get('/:id',requireAuth(), getTaskById);
router.get('/topic/:topicId',requireAuth(), getTasksByTopicId);
router.put('/:id',requireAuth(), updateTask);
router.delete('/:id',requireAuth(), deleteTask);

export default router;