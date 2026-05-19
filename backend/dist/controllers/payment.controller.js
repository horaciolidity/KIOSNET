"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlanPrices = exports.handleMpWebhook = exports.createMpSubscriptionPreference = exports.createMpPreference = void 0;
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
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const mpItems = items.map((item) => ({
            id: item.productId,
            title: item.name || 'Producto KIOSNET',
            quantity: Number(item.quantity),
            unit_price: Number(item.price),
            currency_id: 'ARS'
        }));
        const preferenceBody = {
            items: mpItems,
            back_urls: {
                success: `${frontendUrl}/pos?payment=success`,
                failure: `${frontendUrl}/pos?payment=failure`,
                pending: `${frontendUrl}/pos?payment=pending`
            },
            notification_url: notificationUrl,
            external_reference: pendingSale.id // Store our Supabase Sale ID
        };
        if (frontendUrl.startsWith('https')) {
            preferenceBody.auto_return = 'approved';
        }
        const response = await preference.create({
            body: preferenceBody
        });
        res.json({
            preferenceId: response.id,
            initPoint: response.init_point,
            saleId: pendingSale.id
        });
    }
    catch (error) {
        console.error('Error creating Mercado Pago Preference:', error);
        const details = error.response?.data || error.cause || null;
        res.status(500).json({
            message: 'Error al iniciar pago con Mercado Pago',
            error: error.message,
            details
        });
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
        const { plan } = req.body; // 'STANDARD' or 'PRO'
        if (!plan || (plan !== 'STANDARD' && plan !== 'PRO')) {
            return res.status(400).json({ message: 'Plan no válido. Debe ser STANDARD o PRO.' });
        }
        // Query dynamic pricing from SystemConfig
        const configPrices = await prisma_1.default.systemConfig.findMany();
        let price = plan === 'PRO' ? 15730 : 12320;
        configPrices.forEach(cfg => {
            if (plan === 'PRO' && cfg.key === 'price_pro')
                price = Number(cfg.value) || 15730;
            if (plan === 'STANDARD' && cfg.key === 'price_standard')
                price = Number(cfg.value) || 12320;
        });
        const title = plan === 'PRO' ? 'Suscripción KIOSNET Pro (Mensual)' : 'Suscripción KIOSNET Estándar (Mensual)';
        const planId = plan === 'PRO' ? 'kiosnet_subscription_pro' : 'kiosnet_subscription_standard';
        const client = getMpClient();
        const preference = new mercadopago_1.Preference(client);
        const backendUrl = process.env.BACKEND_URL || 'https://kiosnet-webhook.loca.lt';
        const notificationUrl = `${backendUrl}/api/payments/mercadopago/webhook`;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const preferenceBody = {
            items: [
                {
                    id: planId,
                    title: title,
                    quantity: 1,
                    unit_price: price,
                    currency_id: 'ARS'
                }
            ],
            back_urls: {
                success: `${frontendUrl}/dashboard?sub=success`,
                failure: `${frontendUrl}/dashboard?sub=failure`,
                pending: `${frontendUrl}/dashboard?sub=pending`
            },
            notification_url: notificationUrl,
            external_reference: `sub_${plan}_${tenantId}` // Prefixed with sub_PLAN_ to detect plan on webhook!
        };
        if (frontendUrl.startsWith('https')) {
            preferenceBody.auto_return = 'approved';
        }
        const response = await preference.create({
            body: preferenceBody
        });
        res.json({
            preferenceId: response.id,
            initPoint: response.init_point
        });
    }
    catch (error) {
        console.error('Error creating subscription preference:', error);
        const details = error.response?.data || error.cause || null;
        res.status(500).json({
            message: 'Error al iniciar suscripción',
            error: error.message,
            details
        });
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
                    let tenantId = '';
                    let plan = 'STANDARD';
                    if (externalRef.startsWith('sub_PRO_')) {
                        tenantId = externalRef.replace('sub_PRO_', '');
                        plan = 'PRO';
                    }
                    else if (externalRef.startsWith('sub_STANDARD_')) {
                        tenantId = externalRef.replace('sub_STANDARD_', '');
                        plan = 'STANDARD';
                    }
                    else {
                        // Fallback for older subscription references
                        tenantId = externalRef.replace('sub_', '');
                        plan = 'PRO';
                    }
                    const subExpiresAt = new Date();
                    subExpiresAt.setMonth(subExpiresAt.getMonth() + 1);
                    await prisma_1.default.tenant.update({
                        where: { id: tenantId },
                        data: {
                            subActive: true,
                            plan: plan,
                            subExpiresAt: subExpiresAt
                        }
                    });
                    console.log(`Tenant ${tenantId} subscription set to active (${plan} Plan).`);
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
        res.sendStatus(200);
    }
    catch (error) {
        console.error('Error handling Mercado Pago webhook:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
exports.handleMpWebhook = handleMpWebhook;
// GET /api/payments/prices
const getPlanPrices = async (req, res) => {
    try {
        const configPrices = await prisma_1.default.systemConfig.findMany();
        let priceStandard = 12320;
        let pricePro = 15730;
        configPrices.forEach(cfg => {
            if (cfg.key === 'price_standard')
                priceStandard = Number(cfg.value) || 12320;
            if (cfg.key === 'price_pro')
                pricePro = Number(cfg.value) || 15730;
        });
        res.json({
            price_standard: priceStandard,
            price_pro: pricePro
        });
    }
    catch (error) {
        console.error('Error getting plan prices:', error);
        res.status(500).json({ message: 'Error al obtener los precios de los planes.' });
    }
};
exports.getPlanPrices = getPlanPrices;
