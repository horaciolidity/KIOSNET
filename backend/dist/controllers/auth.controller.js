"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUser = exports.register = exports.login = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma_1.default.user.findUnique({
            where: { email },
            include: { tenant: true }
        });
        if (!user || !user.active) {
            return res.status(401).json({ message: 'Credenciales inválidas o cuenta inactiva' });
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this', { expiresIn: '1d' });
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                tenantId: user.tenantId,
                plan: user.tenant.plan,
                subActive: user.tenant.subActive,
            },
            token,
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error en el servidor al iniciar sesión' });
    }
};
exports.login = login;
const register = async (req, res) => {
    try {
        const { email, password, name, storeName } = req.body;
        if (!email || !password || !name || !storeName) {
            return res.status(400).json({ message: 'Todos los campos son requeridos (email, password, name, storeName)' });
        }
        // Check if the user email is already registered globally
        const existingUser = await prisma_1.default.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
        }
        // Hash the password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Perform database operations in a transaction
        const result = await prisma_1.default.$transaction(async (tx) => {
            // 1. Create a new isolated Tenant (Comercio)
            const tenant = await tx.tenant.create({
                data: {
                    name: storeName,
                    plan: 'PRO',
                    subActive: false, // Starts as inactive; requires subscription payment!
                }
            });
            // 2. Create the Admin user for this Tenant
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    role: 'ADMIN',
                    tenantId: tenant.id
                }
            });
            // 3. Seed default Categories for this Tenant
            await tx.category.createMany({
                data: [
                    { name: 'General', tenantId: tenant.id },
                    { name: 'Bebidas', tenantId: tenant.id },
                    { name: 'Comestibles', tenantId: tenant.id }
                ]
            });
            // 4. Seed default Settings for this Tenant
            await tx.setting.createMany({
                data: [
                    { key: 'business_name', value: storeName, tenantId: tenant.id },
                    { key: 'business_phone', value: '', tenantId: tenant.id },
                    { key: 'business_address', value: '', tenantId: tenant.id },
                    { key: 'business_tax_id', value: '', tenantId: tenant.id },
                    { key: 'mercado_pago_active', value: 'false', tenantId: tenant.id }
                ]
            });
            return { tenant, user };
        });
        res.status(201).json({
            message: 'Comercio registrado exitosamente. Por favor, activa tu cuenta.',
            user: {
                id: result.user.id,
                email: result.user.email,
                name: result.user.name,
                role: result.user.role,
                tenantId: result.user.tenantId,
                plan: result.tenant.plan,
                subActive: result.tenant.subActive,
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error en el servidor al registrar el comercio' });
    }
};
exports.register = register;
const getCurrentUser = async (req, res) => {
    try {
        const authReq = req;
        const userId = authReq.user?.id;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: { tenant: true }
        });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                tenantId: user.tenantId,
                plan: user.tenant.plan,
                subActive: user.tenant.subActive,
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error en el servidor al obtener el perfil' });
    }
};
exports.getCurrentUser = getCurrentUser;
