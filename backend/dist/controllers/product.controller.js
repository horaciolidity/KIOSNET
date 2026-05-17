"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProduct = exports.updateProduct = exports.updateStock = exports.createProduct = exports.getProducts = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const getProducts = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const products = await prisma_1.default.product.findMany({
            where: {
                active: true,
                tenantId
            },
            include: { category: true }
        });
        res.json(products);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al obtener productos' });
    }
};
exports.getProducts = getProducts;
const createProduct = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { name, barcode, categoryId, costPrice, sellingPrice, stock, minStock, unit } = req.body;
        if (!name || !categoryId || costPrice === undefined || sellingPrice === undefined) {
            return res.status(400).json({ message: 'Faltan campos obligatorios' });
        }
        // Check barcode uniqueness only within the active tenant
        if (barcode) {
            const existing = await prisma_1.default.product.findFirst({
                where: { barcode, tenantId }
            });
            if (existing) {
                return res.status(400).json({ message: 'Ya tienes un producto registrado con este código de barras' });
            }
        }
        const product = await prisma_1.default.product.create({
            data: {
                name,
                barcode: barcode || null,
                categoryId,
                costPrice: Number(costPrice),
                sellingPrice: Number(sellingPrice),
                stock: stock !== undefined ? Number(stock) : 0,
                minStock: minStock !== undefined ? Number(minStock) : 5,
                unit: unit || 'UNIDAD',
                tenantId
            }
        });
        res.status(201).json(product);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al crear producto' });
    }
};
exports.createProduct = createProduct;
const updateStock = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { id } = req.params;
        const { quantity } = req.body;
        // Verify ownership
        const existing = await prisma_1.default.product.findFirst({
            where: { id, tenantId }
        });
        if (!existing) {
            return res.status(404).json({ message: 'Producto no encontrado en tu comercio' });
        }
        const product = await prisma_1.default.product.update({
            where: { id },
            data: {
                stock: {
                    increment: Number(quantity)
                }
            }
        });
        res.json(product);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al actualizar stock' });
    }
};
exports.updateStock = updateStock;
const updateProduct = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { id } = req.params;
        const { name, barcode, categoryId, costPrice, sellingPrice, stock, minStock, unit, active } = req.body;
        // Verify ownership
        const existing = await prisma_1.default.product.findFirst({
            where: { id, tenantId }
        });
        if (!existing) {
            return res.status(404).json({ message: 'Producto no encontrado en tu comercio' });
        }
        // Verify barcode uniqueness within the tenant
        if (barcode && barcode !== existing.barcode) {
            const barcodeExists = await prisma_1.default.product.findFirst({
                where: { barcode, tenantId, id: { not: id } }
            });
            if (barcodeExists) {
                return res.status(400).json({ message: 'Ya tienes otro producto registrado con este código de barras' });
            }
        }
        const product = await prisma_1.default.product.update({
            where: { id },
            data: {
                name,
                barcode: barcode || null,
                categoryId,
                costPrice: costPrice !== undefined ? Number(costPrice) : undefined,
                sellingPrice: sellingPrice !== undefined ? Number(sellingPrice) : undefined,
                stock: stock !== undefined ? Number(stock) : undefined,
                minStock: minStock !== undefined ? Number(minStock) : undefined,
                unit,
                active
            }
        });
        res.json(product);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al actualizar producto' });
    }
};
exports.updateProduct = updateProduct;
const deleteProduct = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { id } = req.params;
        // Verify ownership
        const existing = await prisma_1.default.product.findFirst({
            where: { id, tenantId }
        });
        if (!existing) {
            return res.status(404).json({ message: 'Producto no encontrado en tu comercio' });
        }
        // Soft delete to protect database sales history reference integrity
        const product = await prisma_1.default.product.update({
            where: { id },
            data: { active: false }
        });
        res.json({ message: 'Producto eliminado exitosamente', product });
    }
    catch (error) {
        res.status(500).json({ message: 'Error al eliminar producto' });
    }
};
exports.deleteProduct = deleteProduct;
