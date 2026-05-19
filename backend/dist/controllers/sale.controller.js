"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSaleStatus = exports.getSales = exports.createSale = void 0;
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
            select: { status: true }
        });
        if (!sale) {
            return res.status(404).json({ message: 'Venta no encontrada en tu comercio' });
        }
        res.json({ status: sale.status });
    }
    catch (error) {
        res.status(500).json({ message: 'Error al obtener estado de la venta' });
    }
};
exports.getSaleStatus = getSaleStatus;
