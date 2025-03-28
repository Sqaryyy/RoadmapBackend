// stripeWebhookRoutes.ts
import express from 'express';
import { stripeWebhookHandler,rawBodyMiddleware } from '../controllers/stripewebhookController';

const router = express.Router();

router.post('/', rawBodyMiddleware, stripeWebhookHandler); 

export default router;