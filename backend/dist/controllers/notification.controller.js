"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAsRead = exports.getNotifications = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const getNotifications = async (req, res) => {
    try {
        const notifications = await prisma_1.default.notification.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        res.json(notifications);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al obtener notificaciones' });
    }
};
exports.getNotifications = getNotifications;
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.default.notification.update({
            where: { id },
            data: { read: true }
        });
        res.json({ message: 'Notificación leída' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error al actualizar notificación' });
    }
};
exports.markAsRead = markAsRead;
