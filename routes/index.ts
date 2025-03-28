// src/routes/index.ts
import express from 'express';
import userRoutes from './userRoutes';
import aiRoutes from './ai-routes';
import taskRoutes from './taskRoutes';
import topicRoutes from './topicRoutes';
import skillRoutes from './skillRoutes';
import clerkRoutes from './clerk-webhook'
import stripeRoutes from './stripe-webhook'

const router = express.Router();
router.use('/stripe',stripeRoutes);

router.use(express.json()); 
router.use('/users', userRoutes);
router.use('/tasks',taskRoutes);
router.use('/topics',topicRoutes);
router.use('/skills',skillRoutes);
router.use('/clerk',clerkRoutes);
router.use('/ai',aiRoutes);

export default router; 