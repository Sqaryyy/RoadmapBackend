// src/routes/index.ts
import express from 'express';
import userRoutes from './userRoutes';
import aiRoutes from './ai-routes';
import taskRoutes from './taskRoutes';
import topicRoutes from './topicRoutes';
import skillRoutes from './skillRoutes';
import clerkWebhookRoutes from './clerk-webhook'
import stripeWebhookRoutes from './stripe-webhook'
import subscriptionRoutes from './stripeRoutes'

const router = express.Router();
router.use('/stripe',stripeWebhookRoutes);

router.use(express.json()); 
router.use('/users', userRoutes);
router.use('/tasks',taskRoutes);
router.use('/topics',topicRoutes);
router.use('/skills',skillRoutes);
router.use('/clerk',clerkWebhookRoutes);
router.use('/ai',aiRoutes);
router.use('/subscription',subscriptionRoutes)

export default router; 