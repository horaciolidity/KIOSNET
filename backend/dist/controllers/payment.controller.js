"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlanPrices = exports.checkMpSubscriptionStatus = exports.handleMpWebhook = exports.createMpSubscriptionQrOrder = exports.createMpSubscriptionPreference = exports.createMpPreference = void 0;
const mercadopago_1 = require("mercadopago");
const prisma_1 = __importDefault(require("../utils/prisma"));
// Initialize Mercado Pago Client
const getMpClient = () => {
    const token = process.env.MP_ACCESS_TOKEN || 'APP_USR-4849164774633719-051714-00b8cfd0d13fdaf15a8646fe8447a2cc-345296566';
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
        const host = req.get('host') || 'kiosnet.onrender.com';
        const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
        const backendUrl = process.env.BACKEND_URL || (isLocalhost ? 'https://kiosnet-webhook.loca.lt' : `https://${host}`);
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
        preferenceBody.auto_return = 'approved';
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
        const { plan, months = 1 } = req.body; // 'STANDARD' or 'PRO'
        if (!plan || (plan !== 'STANDARD' && plan !== 'PRO')) {
            return res.status(400).json({ message: 'Plan no válido. Debe ser STANDARD o PRO.' });
        }
        const numMonths = parseInt(months, 10) || 1;
        // Query dynamic pricing from SystemConfig
        const configPrices = await prisma_1.default.systemConfig.findMany();
        let price = plan === 'PRO' ? 15730 : 12320;
        configPrices.forEach(cfg => {
            if (plan === 'PRO' && cfg.key === 'price_pro')
                price = Number(cfg.value) || 15730;
            if (plan === 'STANDARD' && cfg.key === 'price_standard')
                price = Number(cfg.value) || 12320;
        });
        const finalPrice = price * numMonths;
        const title = plan === 'PRO' ? `Suscripción KIOSNET Pro (${numMonths} Mes${numMonths > 1 ? 'es' : ''})` : `Suscripción KIOSNET Estándar (${numMonths} Mes${numMonths > 1 ? 'es' : ''})`;
        const planId = plan === 'PRO' ? 'kiosnet_subscription_pro' : 'kiosnet_subscription_standard';
        const client = getMpClient();
        const preference = new mercadopago_1.Preference(client);
        const host = req.get('host') || 'kiosnet.onrender.com';
        const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
        const backendUrl = process.env.BACKEND_URL || (isLocalhost ? 'https://kiosnet-webhook.loca.lt' : `https://${host}`);
        const notificationUrl = `${backendUrl}/api/payments/mercadopago/webhook`;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const preferenceBody = {
            items: [
                {
                    id: planId,
                    title: title,
                    quantity: 1,
                    unit_price: finalPrice,
                    currency_id: 'ARS'
                }
            ],
            back_urls: {
                success: `${frontendUrl}/dashboard?sub=success`,
                failure: `${frontendUrl}/dashboard?sub=failure`,
                pending: `${frontendUrl}/dashboard?sub=pending`
            },
            notification_url: notificationUrl,
            external_reference: `sub_${plan}_${tenantId}_${numMonths}` // Prefixed with sub_PLAN_ to detect plan on webhook!
        };
        preferenceBody.auto_return = 'approved';
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
const createMpSubscriptionQrOrder = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { plan, months = 1 } = req.body; // 'STANDARD' or 'PRO'
        if (!plan || (plan !== 'STANDARD' && plan !== 'PRO')) {
            return res.status(400).json({ message: 'Plan no válido. Debe ser STANDARD o PRO.' });
        }
        const numMonths = parseInt(months, 10) || 1;
        // Query dynamic pricing from SystemConfig
        const configPrices = await prisma_1.default.systemConfig.findMany();
        let price = plan === 'PRO' ? 15730 : 12320;
        configPrices.forEach(cfg => {
            if (plan === 'PRO' && cfg.key === 'price_pro')
                price = Number(cfg.value) || 15730;
            if (plan === 'STANDARD' && cfg.key === 'price_standard')
                price = Number(cfg.value) || 12320;
        });
        const finalPrice = price * numMonths;
        const title = plan === 'PRO' ? `Suscripción KIOSNET Pro (${numMonths} Mes${numMonths > 1 ? 'es' : ''})` : `Suscripción KIOSNET Estándar (${numMonths} Mes${numMonths > 1 ? 'es' : ''})`;
        const planId = plan === 'PRO' ? 'kiosnet_subscription_pro' : 'kiosnet_subscription_standard';
        const client = getMpClient();
        const preference = new mercadopago_1.Preference(client);
        const host = req.get('host') || 'kiosnet.onrender.com';
        const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
        const backendUrl = process.env.BACKEND_URL || (isLocalhost ? 'https://kiosnet-webhook.loca.lt' : `https://${host}`);
        const notificationUrl = `${backendUrl}/api/payments/mercadopago/webhook`;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const preferenceBody = {
            items: [
                {
                    id: planId,
                    title: title,
                    quantity: 1,
                    unit_price: finalPrice,
                    currency_id: 'ARS'
                }
            ],
            back_urls: {
                success: `${frontendUrl}/dashboard?sub=success`,
                failure: `${frontendUrl}/dashboard?sub=failure`,
                pending: `${frontendUrl}/dashboard?sub=pending`
            },
            notification_url: notificationUrl,
            external_reference: `sub_${plan}_${tenantId}_${numMonths}`
        };
        preferenceBody.auto_return = 'approved';
        const response = await preference.create({
            body: preferenceBody
        });
        const initPoint = response.init_point;
        const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(initPoint || '')}`;
        res.json({
            success: true,
            qrImage: qrImage,
            qrCode: initPoint
        });
    }
    catch (error) {
        console.error('Error creating subscription QR order preference:', error);
        res.status(500).json({
            message: 'Error al iniciar pago QR con Mercado Pago',
            error: error.message
        });
    }
};
exports.createMpSubscriptionQrOrder = createMpSubscriptionQrOrder;
const handleMpWebhook = async (req, res) => {
    try {
        const { action, type, data } = req.body;
        const topic = type || req.query.topic || req.query.type;
        console.log(`Mercado Pago IPN Webhook received. Body:`, req.body, `Query:`, req.query);
        let paymentId = data?.id || req.query.id;
        if (topic === 'payment' || action === 'payment.created' || action === 'payment.updated') {
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
                    let months = 1;
                    if (externalRef.startsWith('sub_PRO_') || externalRef.startsWith('sub_STANDARD_')) {
                        const parts = externalRef.split('_');
                        // Format: sub_PRO_tenantId_months
                        plan = parts[1];
                        tenantId = parts[2];
                        if (parts.length > 3) {
                            months = parseInt(parts[3], 10) || 1;
                        }
                    }
                    else {
                        // Fallback for older subscription references
                        tenantId = externalRef.replace('sub_', '');
                        plan = 'PRO';
                    }
                    const tenant = await prisma_1.default.tenant.findUnique({ where: { id: tenantId } });
                    let baseDate = new Date();
                    // If already active and hasn't expired, append to existing expiration!
                    if (tenant?.subActive && tenant.subExpiresAt && tenant.subExpiresAt > new Date()) {
                        baseDate = new Date(tenant.subExpiresAt);
                    }
                    baseDate.setMonth(baseDate.getMonth() + months);
                    await prisma_1.default.tenant.update({
                        where: { id: tenantId },
                        data: {
                            subActive: true,
                            plan: plan,
                            subExpiresAt: baseDate
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
const checkMpSubscriptionStatus = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { plan, months } = req.body;
        // We will build a list of external references to check, prioritizing the one requested
        const referencesToCheck = new Set();
        if (plan && months) {
            referencesToCheck.add(`sub_${plan}_${tenantId}_${months}`);
        }
        // Also add fallback combinations in case they clicked another plan/duration
        const plans = ['PRO', 'STANDARD'];
        const monthOptions = [1, 3, 6, 12];
        plans.forEach(p => {
            monthOptions.forEach(m => {
                referencesToCheck.add(`sub_${p}_${tenantId}_${m}`);
            });
        });
        const client = getMpClient();
        const payment = new mercadopago_1.Payment(client);
        let approvedPaymentFound = false;
        let approvedPlan = 'STANDARD';
        let approvedMonths = 1;
        // Search in Mercado Pago
        for (const ref of referencesToCheck) {
            try {
                const searchResponse = await payment.search({
                    options: {
                        external_reference: ref
                    }
                });
                const approvedPayment = searchResponse.results?.find(p => p.status === 'approved');
                if (approvedPayment) {
                    approvedPaymentFound = true;
                    // Parse plan and months from reference
                    const parts = ref.split('_');
                    approvedPlan = parts[1];
                    approvedMonths = parseInt(parts[3], 10) || 1;
                    break; // Found an approved one, stop searching
                }
            }
            catch (err) {
                console.error(`Error searching MP for reference ${ref}:`, err);
            }
        }
        if (approvedPaymentFound) {
            // Update tenant in database (same logic as webhook!)
            const tenant = await prisma_1.default.tenant.findUnique({ where: { id: tenantId } });
            let baseDate = new Date();
            if (tenant?.subActive && tenant.subExpiresAt && tenant.subExpiresAt > new Date()) {
                baseDate = new Date(tenant.subExpiresAt);
            }
            baseDate.setMonth(baseDate.getMonth() + approvedMonths);
            const updatedTenant = await prisma_1.default.tenant.update({
                where: { id: tenantId },
                data: {
                    subActive: true,
                    plan: approvedPlan,
                    subExpiresAt: baseDate
                }
            });
            console.log(`Manual check: Tenant ${tenantId} subscription set to active (${approvedPlan} Plan, +${approvedMonths} months).`);
            // Return updated user format so frontend can update its store
            const salesCount = await prisma_1.default.sale.count({ where: { tenantId } });
            return res.json({
                success: true,
                message: '¡Pago verificado con éxito!',
                subActive: true,
                user: {
                    id: authReq.user?.id,
                    email: authReq.user?.email,
                    name: authReq.user?.name,
                    role: authReq.user?.role,
                    tenantId: tenantId,
                    plan: updatedTenant.plan,
                    subActive: true,
                    subExpiresAt: updatedTenant.subExpiresAt,
                    salesCount: salesCount
                }
            });
        }
        return res.json({
            success: false,
            subActive: false,
            message: 'El pago aún no ha sido reportado o aprobado en Mercado Pago.'
        });
    }
    catch (error) {
        console.error('Error in checkMpSubscriptionStatus:', error);
        res.status(500).json({ message: 'Error al comprobar el pago en Mercado Pago', error: error.message });
    }
};
exports.checkMpSubscriptionStatus = checkMpSubscriptionStatus;
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
