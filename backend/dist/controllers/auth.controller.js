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
        if (!email || !password) {
            return res.status(400).json({ message: 'El correo y la contraseña son requeridos' });
        }
        // 1. Check if user exists
        let user = await prisma_1.default.user.findUnique({
            where: { email },
            include: { tenant: true }
        });
        let autoRegistered = false;
        if (!user) {
            // 2. AUTO-REGISTRATION: User does not exist, provision tenant + admin account on the fly!
            console.log(`Auto-registrando nuevo comercio y administrador para: ${email}`);
            const storeName = `Comercio de ${email.split('@')[0]}`;
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
            const result = await prisma_1.default.$transaction(async (tx) => {
                // Create Tenant
                const newTenant = await tx.tenant.create({
                    data: {
                        name: storeName,
                        plan: 'FREE',
                        subActive: false, // Needs subscription activation!
                    }
                });
                // Create Admin User
                const newUser = await tx.user.create({
                    data: {
                        email,
                        password: hashedPassword,
                        name: email.split('@')[0],
                        role: 'ADMIN',
                        active: true,
                        tenantId: newTenant.id
                    }
                });
                // Seed default Categories
                await tx.category.createMany({
                    data: [
                        { name: 'General', tenantId: newTenant.id },
                        { name: 'Bebidas', tenantId: newTenant.id },
                        { name: 'Comestibles', tenantId: newTenant.id }
                    ]
                });
                // Seed default Settings
                await tx.setting.createMany({
                    data: [
                        { key: 'business_name', value: storeName, tenantId: newTenant.id },
                        { key: 'business_phone', value: '', tenantId: newTenant.id },
                        { key: 'business_address', value: '', tenantId: newTenant.id },
                        { key: 'business_tax_id', value: '', tenantId: newTenant.id },
                        { key: 'mercado_pago_active', value: 'false', tenantId: newTenant.id }
                    ]
                });
                return { tenant: newTenant, user: newUser };
            });
            // Retrieve full newly created user object
            user = await prisma_1.default.user.findUnique({
                where: { id: result.user.id },
                include: { tenant: true }
            });
            autoRegistered = true;
        }
        else {
            // 3. STANDARD LOGIN: User exists, verify credentials
            const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Contraseña incorrecta' });
            }
        }
        if (!user || !user.active) {
            return res.status(401).json({ message: 'Esta cuenta se encuentra inactiva' });
        }
        // Dynamic subscription expiration check on login
        let subActive = user.tenant.subActive;
        if (subActive && user.tenant.subExpiresAt && user.tenant.subExpiresAt < new Date()) {
            await prisma_1.default.tenant.update({
                where: { id: user.tenantId },
                data: { subActive: false }
            });
            user.tenant.subActive = false;
            subActive = false;
        }
        // 4. Issue JWT Access Token
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this', { expiresIn: '1d' });
        const salesCount = await prisma_1.default.sale.count({
            where: { tenantId: user.tenantId }
        });
        res.json({
            message: autoRegistered
                ? '¡Comercio creado y registrado con éxito!'
                : 'Sesión iniciada correctamente',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                tenantId: user.tenantId,
                plan: user.tenant.plan,
                subActive: subActive,
                subExpiresAt: user.tenant.subExpiresAt,
                salesCount: salesCount
            },
            token,
            autoRegistered
        });
    }
    catch (error) {
        console.error('Error in login auto-registration:', error);
        res.status(500).json({ message: 'Error en el servidor al procesar el inicio de sesión', error: error.message });
    }
};
exports.login = login;
const register = async (req, res) => {
    try {
        const { email, password, name, storeName } = req.body;
        if (!email || !password || !name || !storeName) {
            return res.status(400).json({ message: 'Todos los campos son requeridos (email, password, name, storeName)' });
        }
        const existingUser = await prisma_1.default.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const result = await prisma_1.default.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: {
                    name: storeName,
                    plan: 'FREE',
                    subActive: false,
                }
            });
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    role: 'ADMIN',
                    tenantId: tenant.id
                }
            });
            await tx.category.createMany({
                data: [
                    { name: 'General', tenantId: tenant.id },
                    { name: 'Bebidas', tenantId: tenant.id },
                    { name: 'Comestibles', tenantId: tenant.id }
                ]
            });
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
            message: 'Comercio registrado exitosamente.',
            user: {
                id: result.user.id,
                email: result.user.email,
                name: result.user.name,
                role: result.user.role,
                tenantId: result.user.tenantId,
                plan: result.tenant.plan,
                subActive: result.tenant.subActive,
                subExpiresAt: result.tenant.subExpiresAt,
                salesCount: 0
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
        // Dynamic subscription expiration check
        let subActive = user.tenant.subActive;
        if (subActive && user.tenant.subExpiresAt && user.tenant.subExpiresAt < new Date()) {
            await prisma_1.default.tenant.update({
                where: { id: user.tenantId },
                data: { subActive: false }
            });
            user.tenant.subActive = false;
            subActive = false;
        }
        const salesCount = await prisma_1.default.sale.count({
            where: { tenantId: user.tenantId }
        });
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                tenantId: user.tenantId,
                plan: user.tenant.plan,
                subActive: subActive,
                subExpiresAt: user.tenant.subExpiresAt,
                salesCount: salesCount
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error en el servidor al obtener el perfil' });
    }
};
exports.getCurrentUser = getCurrentUser;
