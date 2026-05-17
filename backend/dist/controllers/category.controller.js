"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCategory = exports.getCategories = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const getCategories = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const categories = await prisma_1.default.category.findMany({
            where: { tenantId },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });
        res.json(categories);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al obtener categorías' });
    }
};
exports.getCategories = getCategories;
const createCategory = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'El nombre es obligatorio' });
        }
        // Check localized uniqueness for this tenant only
        const existing = await prisma_1.default.category.findFirst({
            where: { name, tenantId }
        });
        if (existing) {
            return res.status(400).json({ message: 'La categoría ya existe en tu comercio' });
        }
        const category = await prisma_1.default.category.create({
            data: {
                name,
                tenantId
            }
        });
        res.status(201).json(category);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al crear categoría' });
    }
};
exports.createCategory = createCategory;
