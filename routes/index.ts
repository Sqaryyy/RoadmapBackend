// src/routes/index.ts
import express from 'express';
import userRoutes from './userRoutes';
import aiRoutes from './ai-routes';
import taskRoutes from './taskRoutes';
import topicRoutes from './topicRoutes';
import skillRoutes from './skillRoutes';
import clerkWebhookRoutes from './clerk-webhook';
import stripeWebhookRoutes from './stripe-webhook';
import subscriptionRoutes from './stripeRoutes';
import { generalRateLimiterMiddleware,aiRateLimiterMiddleware } from '../utils/rateLimiter';

const router = express.Router();

// Don't rate limit webhook routes
router.use('/stripe', stripeWebhookRoutes);

router.use(express.json());
router.use('/clerk', clerkWebhookRoutes);
// Apply general rate limiting to all routes
router.use(generalRateLimiterMiddleware);

// Regular routes with general rate limiting
router.use('/users', userRoutes);
router.use('/tasks', taskRoutes);
router.use('/topics', topicRoutes);
router.use('/skills', skillRoutes);
router.use('/subscription', subscriptionRoutes);

// Apply stricter rate limiting to AI routes
router.use('/ai', aiRateLimiterMiddleware, aiRoutes);

export default router;