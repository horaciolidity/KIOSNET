"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = require("../controllers/payment.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/prices', payment_controller_1.getPlanPrices);
router.post('/mercadopago/preference', auth_middleware_1.authMiddleware, payment_controller_1.createMpPreference);
router.post('/mercadopago/subscription', auth_middleware_1.authMiddleware, payment_controller_1.createMpSubscriptionPreference);
router.post('/mercadopago/subscription-qr', auth_middleware_1.authMiddleware, payment_controller_1.createMpSubscriptionQrOrder);
router.post('/mercadopago/check-subscription', auth_middleware_1.authMiddleware, payment_controller_1.checkMpSubscriptionStatus);
router.post('/mercadopago/activate-subscription', auth_middleware_1.authMiddleware, payment_controller_1.activateSubscriptionFromRedirect);
router.post('/mercadopago/webhook', payment_controller_1.handleMpWebhook); // Must remain public for Mercado Pago callbacks
exports.default = router;
