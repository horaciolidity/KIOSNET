"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSaleStatus = exports.getSales = exports.createSale = void 0;
const mercadopago_1 = require("mercadopago");
const prisma_1 = __importDefault(require("../utils/prisma"));
const createSale = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        // SaaS Multitenant billing blocker: Block creating sales if the tenant has >= 50 sales and no active subscription
        const salesCount = await prisma_1.default.sale.count({
            where: { tenantId }
        });
        if (!authReq.user?.subActive && salesCount >= 50) {
            return res.status(403).json({
                message: 'Límite de ventas gratuitas (50 ventas) alcanzado. Por favor, activa tu suscripción en Configuración para continuar realizando ventas.'
            });
        }
        const { total, subtotal, discount, paymentMethod, customerId, sellerId, items, receivedAmount, changeAmount } = req.body;
        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'No se puede procesar una venta vacía' });
        }
        // Use a transaction to ensure all operations succeed or fail together
        const sale = await prisma_1.default.$transaction(async (tx) => {
            // 1. Create the sale
            const newSale = await tx.sale.create({
                data: {
                    total: Number(total),
                    subtotal: Number(subtotal),
                    discount: Number(discount || 0),
                    paymentMethod,
                    customerId: customerId || null,
                    sellerId,
                    tenantId,
                    receivedAmount: receivedAmount !== undefined ? Number(receivedAmount) : null,
                    changeAmount: changeAmount !== undefined ? Number(changeAmount) : null,
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
            // 2. Update stock for each item in this tenant
            for (const item of items) {
                // Verify ownership and subtract stock
                const prod = await tx.product.findFirst({
                    where: { id: item.productId, tenantId }
                });
                if (!prod) {
                    throw new Error(`Producto ${item.productId} no encontrado o no pertenece a tu comercio`);
                }
                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: {
                            decrement: Number(item.quantity)
                        }
                    }
                });
            }
            // 3. If it's a credit sale, update customer balance in this tenant
            if (paymentMethod === 'CREDIT' && customerId) {
                const cust = await tx.customer.findFirst({
                    where: { id: customerId, tenantId }
                });
                if (!cust) {
                    throw new Error(`Cliente no encontrado o no pertenece a tu comercio`);
                }
                await tx.customer.update({
                    where: { id: customerId },
                    data: {
                        balance: {
                            increment: Number(total)
                        }
                    }
                });
            }
            return newSale;
        });
        res.status(201).json(sale);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || 'Error al procesar la venta' });
    }
};
exports.createSale = createSale;
const getSales = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const sales = await prisma_1.default.sale.findMany({
            where: { tenantId },
            include: {
                items: { include: { product: true } },
                customer: true,
                seller: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(sales);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al obtener ventas' });
    }
};
exports.getSales = getSales;
const getSaleStatus = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { id } = req.params;
        const sale = await prisma_1.default.sale.findFirst({
            where: { id, tenantId },
            include: { items: true }
        });
        if (!sale) {
            return res.status(404).json({ message: 'Venta no encontrada en tu comercio' });
        }
        // If it's still pending in our database, actively query Mercado Pago to verify
        if (sale.status === 'PENDING') {
            try {
                const token = process.env.MP_ACCESS_TOKEN || 'APP_USR-4849164774633719-051714-00b8cfd0d13fdaf15a8646fe8447a2cc-345296566';
                const client = new mercadopago_1.MercadoPagoConfig({
                    accessToken: token,
                    options: { timeout: 5000 }
                });
                const payment = new mercadopago_1.Payment(client);
                const searchResponse = await payment.search({
                    options: {
                        external_reference: id
                    }
                });
                const approvedPayment = searchResponse.results?.find(p => p.status === 'approved');
                if (approvedPayment) {
                    // Process the sale approval (same transaction logic as webhook!)
                    await prisma_1.default.$transaction(async (tx) => {
                        // Mark sale as completed
                        await tx.sale.update({
                            where: { id },
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
                            where: { userId: sale.sellerId, status: 'OPEN', tenantId }
                        });
                        if (activeRegister) {
                            await tx.cashMovement.create({
                                data: {
                                    registerId: activeRegister.id,
                                    amount: sale.total,
                                    type: 'IN',
                                    description: `Venta MP QR #${id} [Aprobada - Consulta Directa]`
                                }
                            });
                        }
                    });
                    console.log(`Sale ${id} successfully approved via active MP status check.`);
                    return res.json({ status: 'COMPLETED' });
                }
            }
            catch (mpError) {
                console.error('Error checking payment status in Mercado Pago:', mpError);
            }
        }
        res.json({ status: sale.status });
    }
    catch (error) {
        res.status(500).json({ message: 'Error al obtener estado de la venta' });
    }
};
exports.getSaleStatus = getSaleStatus;
