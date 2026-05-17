import { Router } from 'express';
import { createMpPreference, handleMpWebhook } from '../controllers/payment.controller';

const router = Router();

router.post('/mercadopago/preference', createMpPreference);
router.post('/mercadopago/webhook', handleMpWebhook);

export default router;
