"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMpWebhook = exports.createMpSubscriptionPreference = exports.createMpPreference = void 0;
const mercadopago_1 = require("mercadopago");
const prisma_1 = __importDefault(require("../utils/prisma"));
// Initialize Mercado Pago Client
const getMpClient = () => {
    const token = process.env.MP_ACCESS_TOKEN || 'TEST-64a388b6-9977-488e-840e-c02bc9041fc4';
    return new mercadopago_1.MercadoPagoConfig({
        accessToken: token,
        options: { timeout: 5000 }
    });
};
const createMpPreference = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { total, customerId, sellerId, items } = req.body;
        // 1. Create a PENDING Sale in the database first
        const pendingSale = await prisma_1.default.sale.create({
            data: {
                total: Number(total),
                subtotal: Number(total),
                discount: 0,
                paymentMethod: 'TRANSFER', // MP counts as transfer/card
                status: 'PENDING',
                customerId: customerId || null,
                sellerId,
                tenantId,
                items: {
                    create: items.map((item) => ({
                        productId: item.productId,
                        quantity: Number(item.quantity),
                        price: Number(item.price),
                        costPrice: Number(item.costPrice)
                    }))
                }
            }
        });
        // 2. Build Mercado Pago Preference
        const client = getMpClient();
        const preference = new mercadopago_1.Preference(client);
        const backendUrl = process.env.BACKEND_URL || 'https://kiosnet-webhook.loca.lt';
        const notificationUrl = `${backendUrl}/api/payments/mercadopago/webhook`;
        const mpItems = items.map((item) => ({
            id: item.productId,
            title: item.name || 'Producto KIOSNET',
            quantity: Number(item.quantity),
            unit_price: Number(item.price),
            currency_id: 'ARS'
        }));
        const response = await preference.create({
            body: {
                items: mpItems,
                back_urls: {
                    success: 'http://localhost:5173/pos?payment=success',
                    failure: 'http://localhost:5173/pos?payment=failure',
                    pending: 'http://localhost:5173/pos?payment=pending'
                },
                auto_return: 'approved',
                notification_url: notificationUrl,
                external_reference: pendingSale.id // Store our Supabase Sale ID
            }
        });
        res.json({
            preferenceId: response.id,
            initPoint: response.init_point,
            saleId: pendingSale.id
        });
    }
    catch (error) {
        console.error('Error creating Mercado Pago Preference:', error);
        res.status(500).json({ message: 'Error al iniciar pago con Mercado Pago', error: error.message });
    }
};
exports.createMpPreference = createMpPreference;
const createMpSubscriptionPreference = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const client = getMpClient();
        const preference = new mercadopago_1.Preference(client);
        const backendUrl = process.env.BACKEND_URL || 'https://kiosnet-webhook.loca.lt';
        const notificationUrl = `${backendUrl}/api/payments/mercadopago/webhook`;
        // Monthly subscription price of $5000 ARS
        const response = await preference.create({
            body: {
                items: [
                    {
                        id: 'kiosnet_subscription_pro',
                        title: 'Suscripción KIOSNET Pro (Mensual)',
                        quantity: 1,
                        unit_price: 5000,
                        currency_id: 'ARS'
                    }
                ],
                back_urls: {
                    success: 'http://localhost:5173/dashboard?sub=success',
                    failure: 'http://localhost:5173/dashboard?sub=failure',
                    pending: 'http://localhost:5173/dashboard?sub=pending'
                },
                auto_return: 'approved',
                notification_url: notificationUrl,
                external_reference: `sub_${tenantId}` // Prefixed with sub_ to mark it as subscription pay!
            }
        });
        res.json({
            preferenceId: response.id,
            initPoint: response.init_point
        });
    }
    catch (error) {
        console.error('Error creating subscription preference:', error);
        res.status(500).json({ message: 'Error al iniciar suscripción', error: error.message });
    }
};
exports.createMpSubscriptionPreference = createMpSubscriptionPreference;
const handleMpWebhook = async (req, res) => {
    try {
        const { action, type, data } = req.body;
        console.log(`Mercado Pago IPN Webhook received: ${type} - ${action}`, req.body);
        let paymentId = data?.id || req.query.id;
        if (type === 'payment' || action === 'payment.created' || action === 'payment.updated') {
            if (!paymentId) {
                return res.status(400).json({ message: 'No payment ID found in webhook' });
            }
            const client = getMpClient();
            const payment = new mercadopago_1.Payment(client);
            const paymentInfo = await payment.get({ id: paymentId });
            const externalRef = paymentInfo.external_reference;
            console.log(`Mercado Pago Payment verified. ID: ${paymentId}, Status: ${paymentInfo.status}, External Ref: ${externalRef}`);
            if (paymentInfo.status === 'approved' && externalRef) {
                if (externalRef.startsWith('sub_')) {
                    // 1. Process Subscription Payment
                    const tenantId = externalRef.replace('sub_', '');
                    await prisma_1.default.tenant.update({
                        where: { id: tenantId },
                        data: {
                            subActive: true,
                            plan: 'PRO'
                        }
                    });
                    console.log(`Tenant ${tenantId} subscription set to active (PRO Plan).`);
                }
                else {
                    // 2. Process Standard Sale Payment
                    const saleId = externalRef;
                    const sale = await prisma_1.default.sale.findUnique({
                        where: { id: saleId },
                        include: { items: true }
                    });
                    if (sale && sale.status === 'PENDING') {
                        await prisma_1.default.$transaction(async (tx) => {
                            // Mark sale as completed
                            await tx.sale.update({
                                where: { id: saleId },
                                data: { status: 'COMPLETED' }
                            });
                            // Decrement physical stock
                            for (const item of sale.items) {
                                await tx.product.update({
                                    where: { id: item.productId },
                                    data: {
                                        stock: {
                                            decrement: item.quantity
                                        }
                                    }
                                });
                            }
                            // Register cash movement
                            const activeRegister = await tx.cashRegister.findFirst({
                                where: { userId: sale.sellerId, status: 'OPEN', tenantId: sale.tenantId }
                            });
                            if (activeRegister) {
                                await tx.cashMovement.create({
                                    data: {
                                        registerId: activeRegister.id,
                                        amount: sale.total,
                                        type: 'IN',
                                        description: `Venta MP QR #${saleId} [Aprobada]`
                                    }
                                });
                            }
                        });
                        console.log(`Sale ${saleId} successfully updated to COMPLETED and inventory adjusted.`);
                    }
                }
            }
        }
        res.status(200).send('OK');
    }
    catch (error) {
        console.error('Error handling Mercado Pago Webhook:', error);
        res.status(200).send('OK');
    }
};
exports.handleMpWebhook = handleMpWebhook;
