"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = require("../controllers/payment.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post('/mercadopago/preference', auth_middleware_1.authMiddleware, payment_controller_1.createMpPreference);
router.post('/mercadopago/subscription', auth_middleware_1.authMiddleware, payment_controller_1.createMpSubscriptionPreference);
router.post('/mercadopago/webhook', payment_controller_1.handleMpWebhook); // Must remain public for Mercado Pago callbacks
exports.default = router;
