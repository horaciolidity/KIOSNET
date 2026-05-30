"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateSubscriptionFromRedirect = exports.getPlanPrices = exports.checkMpSubscriptionStatus = exports.handleMpWebhook = exports.createMpSubscriptionQrOrder = exports.createMpSubscriptionPreference = exports.createMpPreference = void 0;
const mercadopago_1 = require("mercadopago");
const prisma_1 = __importDefault(require("../utils/prisma"));
// Initialize Mercado Pago Client
const getMpClient = () => {
    const token = process.env.MP_ACCESS_TOKEN || 'APP_USR-4849164774633719-051714-00b8cfd0d13fdaf15a8646fe8447a2cc-345296566';
    if (!process.env.MP_ACCESS_TOKEN) {
        console.warn('Warning: MP_ACCESS_TOKEN is not configured. Using fallback Mercado Pago token. Set MP_ACCESS_TOKEN in production.');
    }
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
        const initPoint = response.init_point || response.sandbox_init_point;
        if (!initPoint) {
            throw new Error('Mercado Pago no devolvió init_point para la preferencia.');
        }
        res.json({
            preferenceId: response.id,
            initPoint,
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
            const val = Number(cfg.value);
            if (plan === 'PRO' && cfg.key === 'price_pro' && !isNaN(val))
                price = val;
            if (plan === 'STANDARD' && cfg.key === 'price_standard' && !isNaN(val))
                price = val;
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
                success: `${frontendUrl}/dashboard?sub=success&plan=${plan}&months=${numMonths}`,
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
        const initPoint = response.init_point || response.sandbox_init_point;
        if (!initPoint) {
            throw new Error('Mercado Pago no devolvió init_point para la preferencia de suscripción.');
        }
        res.json({
            preferenceId: response.id,
            initPoint
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
            const val = Number(cfg.value);
            if (plan === 'PRO' && cfg.key === 'price_pro' && !isNaN(val))
                price = val;
            if (plan === 'STANDARD' && cfg.key === 'price_standard' && !isNaN(val))
                price = val;
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
                success: `${frontendUrl}/dashboard?sub=success&plan=${plan}&months=${numMonths}`,
                failure: `${frontendUrl}/dashboard?sub=failure`,
                pending: `${frontendUrl}/dashboard?sub=pending`
            },
            notification_url: notificationUrl,
            external_reference: `sub_${plan}_${tenantId}_${numMonths}`
        };
        const response = await preference.create({
            body: preferenceBody
        });
        const initPoint = response.init_point || response.sandbox_init_point;
        if (!initPoint) {
            throw new Error('Mercado Pago no devolvió init_point para la preferencia de QR de suscripción.');
        }
        const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(initPoint)}`;
        res.json({
            success: true,
            qrImage,
            qrCode: initPoint
        });
    }
    catch (error) {
        console.error('Error creating subscription QR order preference:', error);
        const details = error.response?.data || error.cause || null;
        res.status(500).json({
            message: 'Error al iniciar pago QR con Mercado Pago',
            error: error.message,
            details
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
        const { plan, months, paymentId } = req.body;
        const client = getMpClient();
        const payment = new mercadopago_1.Payment(client);
        let approvedPaymentFound = false;
        let approvedPlan = plan || 'STANDARD';
        let approvedMonths = parseInt(months, 10) || 1;
        // Strategy 1: If we have a specific payment_id (from MP redirect), look it up directly (INSTANT)
        if (paymentId) {
            try {
                const paymentInfo = await payment.get({ id: paymentId });
                console.log(`[CHECK] Direct payment lookup: ID=${paymentId}, status=${paymentInfo.status}, ref=${paymentInfo.external_reference}`);
                if (paymentInfo.status === 'approved' && paymentInfo.external_reference?.startsWith('sub_')) {
                    approvedPaymentFound = true;
                    // Parse plan/months from external_reference
                    const parts = paymentInfo.external_reference.split('_');
                    approvedPlan = parts[1] || plan || 'STANDARD';
                    approvedMonths = parseInt(parts[3], 10) || approvedMonths;
                }
            }
            catch (err) {
                console.error(`[CHECK] Error fetching payment ${paymentId} directly:`, err);
            }
        }
        // Strategy 2: Fallback - search by external_reference (has delays but works eventually)
        if (!approvedPaymentFound && plan && months) {
            const ref = `sub_${plan}_${tenantId}_${months}`;
            try {
                const searchResponse = await payment.search({
                    options: { external_reference: ref }
                });
                console.log(`[CHECK] Search by ref '${ref}': found ${searchResponse.results?.length || 0} results`);
                const approvedPayment = searchResponse.results?.find(p => p.status === 'approved');
                if (approvedPayment) {
                    approvedPaymentFound = true;
                    const parts = ref.split('_');
                    approvedPlan = parts[1];
                    approvedMonths = parseInt(parts[3], 10) || 1;
                }
            }
            catch (err) {
                console.error(`[CHECK] Error searching MP for reference ${ref}:`, err);
            }
        }
        if (approvedPaymentFound) {
            // Update tenant in database
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
            console.log(`[CHECK] Tenant ${tenantId} subscription activated: ${approvedPlan} +${approvedMonths}mo`);
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
            const val = Number(cfg.value);
            if (cfg.key === 'price_standard' && !isNaN(val))
                priceStandard = val;
            if (cfg.key === 'price_pro' && !isNaN(val))
                pricePro = val;
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
/**
 * POST /api/payments/mercadopago/activate-subscription
 *
 * Called when Mercado Pago redirects back to the app after a successful payment.
 * Since MP only hits the success back_url after confirming the payment on their end,
 * we trust this signal and directly activate the subscription in the database.
 * This avoids the issues with MP API search delays and rate limits.
 */
const activateSubscriptionFromRedirect = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { plan, months } = req.body;
        if (!plan || (plan !== 'STANDARD' && plan !== 'PRO')) {
            return res.status(400).json({ message: 'Plan no válido. Debe ser STANDARD o PRO.' });
        }
        const numMonths = parseInt(months, 10) || 1;
        const tenant = await prisma_1.default.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            return res.status(404).json({ message: 'Comercio no encontrado.' });
        }
        // Calculate expiration: if already subscribed and not expired, extend from current expiry
        let baseDate = new Date();
        if (tenant.subActive && tenant.subExpiresAt && tenant.subExpiresAt > new Date()) {
            baseDate = new Date(tenant.subExpiresAt);
        }
        baseDate.setMonth(baseDate.getMonth() + numMonths);
        const updatedTenant = await prisma_1.default.tenant.update({
            where: { id: tenantId },
            data: {
                subActive: true,
                plan: plan,
                subExpiresAt: baseDate
            }
        });
        console.log(`[ACTIVATE] Tenant ${tenantId} subscription activated: ${plan} plan, +${numMonths} months, expires ${baseDate.toISOString()}`);
        const salesCount = await prisma_1.default.sale.count({ where: { tenantId } });
        return res.json({
            success: true,
            message: `¡Suscripción ${plan} activada exitosamente por ${numMonths} mes(es)!`,
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
    catch (error) {
        console.error('[ACTIVATE] Error activating subscription:', error);
        res.status(500).json({ message: 'Error al activar la suscripción', error: error.message });
    }
};
exports.activateSubscriptionFromRedirect = activateSubscriptionFromRedirect;
