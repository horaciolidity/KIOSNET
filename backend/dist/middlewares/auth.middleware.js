"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No autorizado. Token faltante.' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this');
        const user = await prisma_1.default.user.findUnique({
            where: { id: decoded.id },
            include: { tenant: true },
        });
        if (!user || !user.active) {
            return res.status(401).json({ message: 'Usuario no encontrado o inactivo.' });
        }
        let subActive = user.tenant.subActive;
        if (subActive && user.tenant.subExpiresAt && user.tenant.subExpiresAt < new Date()) {
            // Auto-expire subscription dynamically in DB
            await prisma_1.default.tenant.update({
                where: { id: user.tenantId },
                data: { subActive: false }
            });
            subActive = false;
        }
        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
            plan: user.tenant.plan,
            subActive: subActive,
            subExpiresAt: user.tenant.subExpiresAt,
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ message: 'Sesión inválida o expirada.' });
    }
};
exports.authMiddleware = authMiddleware;
