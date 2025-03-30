import express from 'express';
import {
    createUser,
    getUserById,
    getUserByClerkId,
    updateUser,
    deleteUser,
    createSubscription,  // Import the createSubscription controller
    success              // Import the success controller
} from '../controllers/userController';
import { requireAuth } from '@clerk/express';
import { 
    canCreateTopic, 
    incrementTopicCounter,
    canAddSkill, 
    incrementSkillCounter 
} from '../utils/userLimits';
import { ClerkRequest } from '../utils/userLimits';

const router = express.Router();

router.post('/', requireAuth(), createUser);
router.get('/:id', requireAuth(), getUserById);
router.get('/clerk/:clerkId', requireAuth(), getUserByClerkId);
router.put('/:id', requireAuth(), updateUser);
router.delete('/:id', requireAuth(), deleteUser);

// Stripe Subscription Routes
router.post('/create-subscription', requireAuth(),createSubscription); // Route to create a Stripe Checkout Session
router.get('/success', requireAuth(), success); // Route for successful subscription

// Topic Limits Routes
router.get('/check/can-create-topic', (req, res) => {
    return canCreateTopic(req as ClerkRequest, res);
});

router.post('/increment-topic-counter', requireAuth(), (req, res) => {
    return incrementTopicCounter(req as ClerkRequest, res);
});

// Skill Limits Routes
router.get('/check/can-add-skill', (req, res) => {
    return canAddSkill(req as ClerkRequest, res);
});

router.post('/increment-skill-counter', requireAuth(), (req, res) => {
    return incrementSkillCounter(req as ClerkRequest, res);
});

export default router;
