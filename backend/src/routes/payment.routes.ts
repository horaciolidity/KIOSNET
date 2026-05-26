import { Router } from 'express';
import { createMpPreference, createMpSubscriptionPreference, createMpSubscriptionQrOrder, handleMpWebhook, getPlanPrices, checkMpSubscriptionStatus, activateSubscriptionFromRedirect } from '../controllers/payment.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.get('/prices', getPlanPrices);
router.post('/mercadopago/preference', authMiddleware, createMpPreference);
router.post('/mercadopago/subscription', authMiddleware, createMpSubscriptionPreference);
router.post('/mercadopago/subscription-qr', authMiddleware, createMpSubscriptionQrOrder);
router.post('/mercadopago/check-subscription', authMiddleware, checkMpSubscriptionStatus);
router.post('/mercadopago/activate-subscription', authMiddleware, activateSubscriptionFromRedirect);
router.post('/mercadopago/webhook', handleMpWebhook); // Must remain public for Mercado Pago callbacks

export default router;
