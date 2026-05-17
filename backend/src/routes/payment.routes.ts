import { Router } from 'express';
import { createMpPreference, createMpSubscriptionPreference, handleMpWebhook } from '../controllers/payment.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/mercadopago/preference', authMiddleware, createMpPreference);
router.post('/mercadopago/subscription', authMiddleware, createMpSubscriptionPreference);
router.post('/mercadopago/webhook', handleMpWebhook); // Must remain public for Mercado Pago callbacks

export default router;
