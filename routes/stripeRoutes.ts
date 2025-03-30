// src/routes/subscriptionRoutes.ts
import express, { Request, Response } from 'express'; // Import Request and Response
import { startProTrial, cancelUserSubscription } from '../controllers/subscriptionController';
import { requireAuth } from '@clerk/express';
import { ClerkRequest } from '../utils/userLimits';

const router = express.Router();

router.post('/trial', requireAuth(), (req: Request, res: Response) => {
  return startProTrial(req as ClerkRequest, res);
});

router.post('/cancel', requireAuth(), (req: Request, res: Response) => {
  return cancelUserSubscription(req as ClerkRequest, res);
});

export default router;