// userRoutes.ts
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
import { canCreateTopic,incrementTopicCounter } from '../utils/userLimits';
import { ClerkRequest } from '../utils/userLimits';

const router = express.Router();

router.post('/', requireAuth(), createUser);
router.get('/:id', requireAuth(), getUserById);
router.get('/clerk/:clerkId', requireAuth(), getUserByClerkId);
router.put('/:id', requireAuth(), updateUser);
router.delete('/:id', requireAuth(), deleteUser);

// Stripe Subscription Routes
router.post('/create-subscription', createSubscription); // Route to create a Stripe Checkout Session
router.get('/success', requireAuth(), success); // Route for successful subscription

//App Limits Routes
router.get('/check/can-create-topic', requireAuth(), (req, res) => {
    // The req here will have the auth property added by requireAuth
    return canCreateTopic(req as ClerkRequest, res);
  });
  
router.post('/can-create-topic', requireAuth(), (req, res) => {
    return incrementTopicCounter(req as ClerkRequest, res);
});

export default router;