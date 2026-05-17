"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCustomer = exports.updateCustomer = exports.getCustomerBalance = exports.createCustomer = exports.getCustomers = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const getCustomers = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const customers = await prisma_1.default.customer.findMany({
            where: { tenantId },
            include: { sales: true },
            orderBy: { name: 'asc' }
        });
        res.json(customers);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al obtener clientes' });
    }
};
exports.getCustomers = getCustomers;
const createCustomer = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { name, phone, address, creditLimit } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'El nombre es obligatorio' });
        }
        const customer = await prisma_1.default.customer.create({
            data: {
                name,
                phone,
                address,
                creditLimit: creditLimit ? Number(creditLimit) : 0,
                tenantId
            }
        });
        res.status(201).json(customer);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al crear cliente' });
    }
};
exports.createCustomer = createCustomer;
const getCustomerBalance = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { id } = req.params;
        const customer = await prisma_1.default.customer.findFirst({
            where: { id, tenantId },
            select: { balance: true, creditLimit: true }
        });
        if (!customer) {
            return res.status(404).json({ message: 'Cliente no encontrado en tu comercio' });
        }
        res.json(customer);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al obtener balance' });
    }
};
exports.getCustomerBalance = getCustomerBalance;
const updateCustomer = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { id } = req.params;
        const { name, phone, address, creditLimit, balance } = req.body;
        // Verify ownership
        const existing = await prisma_1.default.customer.findFirst({
            where: { id, tenantId }
        });
        if (!existing) {
            return res.status(404).json({ message: 'Cliente no encontrado en tu comercio' });
        }
        const customer = await prisma_1.default.customer.update({
            where: { id },
            data: {
                name,
                phone,
                address,
                creditLimit: creditLimit !== undefined ? Number(creditLimit) : undefined,
                balance: balance !== undefined ? Number(balance) : undefined
            }
        });
        res.json(customer);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al actualizar cliente' });
    }
};
exports.updateCustomer = updateCustomer;
const deleteCustomer = async (req, res) => {
    try {
        const authReq = req;
        const tenantId = authReq.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
        }
        const { id } = req.params;
        // Verify ownership
        const existing = await prisma_1.default.customer.findFirst({
            where: { id, tenantId }
        });
        if (!existing) {
            return res.status(404).json({ message: 'Cliente no encontrado en tu comercio' });
        }
        await prisma_1.default.customer.delete({
            where: { id }
        });
        res.json({ message: 'Cliente eliminado exitosamente' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error al eliminar cliente' });
    }
};
exports.deleteCustomer = deleteCustomer;
