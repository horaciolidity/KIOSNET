"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveRegister = exports.addMovement = exports.getMovements = exports.closeRegister = exports.openRegister = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const openRegister = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { userId, openingBalance, notes } = req.body;
        const existingOpen = await prisma_1.default.cashRegister.findFirst({
            where: { userId, status: 'OPEN', tenantId }
        });
        if (existingOpen) {
            return res.status(400).json({ message: 'Ya tienes una caja abierta en tu comercio' });
        }
        const register = await prisma_1.default.cashRegister.create({
            data: {
                userId,
                openingBalance: Number(openingBalance),
                notes,
                status: 'OPEN',
                tenantId
            }
        });
        res.status(201).json(register);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al abrir caja' });
    }
};
exports.openRegister = openRegister;
const closeRegister = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { id } = req.params;
        const { closingBalance, notes } = req.body;
        // Verify ownership
        const existing = await prisma_1.default.cashRegister.findFirst({
            where: { id, tenantId }
        });
        if (!existing) {
            return res.status(404).json({ message: 'Caja no encontrada en tu comercio' });
        }
        const register = await prisma_1.default.cashRegister.update({
            where: { id },
            data: {
                closingBalance: Number(closingBalance),
                notes,
                status: 'CLOSED',
                closedAt: new Date()
            }
        });
        res.json(register);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al cerrar caja' });
    }
};
exports.closeRegister = closeRegister;
const getMovements = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { id } = req.params;
        // Verify ownership of the register
        const register = await prisma_1.default.cashRegister.findFirst({
            where: { id, tenantId }
        });
        if (!register) {
            return res.status(404).json({ message: 'Caja no encontrada en tu comercio' });
        }
        const movements = await prisma_1.default.cashMovement.findMany({
            where: { registerId: id },
            orderBy: { createdAt: 'desc' }
        });
        res.json(movements);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al obtener movimientos' });
    }
};
exports.getMovements = getMovements;
const addMovement = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { registerId, amount, type, description } = req.body;
        // Verify register ownership
        const register = await prisma_1.default.cashRegister.findFirst({
            where: { id: registerId, tenantId }
        });
        if (!register) {
            return res.status(404).json({ message: 'Caja no encontrada en tu comercio' });
        }
        const movement = await prisma_1.default.cashMovement.create({
            data: {
                registerId,
                amount: Number(amount),
                type,
                description
            }
        });
        res.status(201).json(movement);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al registrar movimiento' });
    }
};
exports.addMovement = addMovement;
const getActiveRegister = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { userId } = req.params;
        const register = await prisma_1.default.cashRegister.findFirst({
            where: { userId, status: 'OPEN', tenantId },
            include: { movements: true }
        });
        res.json(register);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al obtener caja activa' });
    }
};
exports.getActiveRegister = getActiveRegister;
