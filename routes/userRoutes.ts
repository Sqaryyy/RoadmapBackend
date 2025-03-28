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

const router = express.Router();

router.post('/', requireAuth(), createUser);
router.get('/:id', requireAuth(), getUserById);
router.get('/clerk/:clerkId', requireAuth(), getUserByClerkId);
router.put('/:id', requireAuth(), updateUser);
router.delete('/:id', requireAuth(), deleteUser);

// Stripe Subscription Routes
router.post('/create-subscription', createSubscription); // Route to create a Stripe Checkout Session
router.get('/success', requireAuth(), success); // Route for successful subscription

export default router;