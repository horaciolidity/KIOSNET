"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleTenantStatus = exports.updatePlanPrices = exports.getAdminDashboard = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// Helper to check super admin authorization
const authorizeSuperAdmin = (req, res) => {
    const user = req.user;
    if (!user || user.email !== 'horaciowalterortiz@gmail.com') {
        res.status(403).json({ message: 'Acceso denegado. Solo el súper administrador horaciowalterortiz@gmail.com puede acceder.' });
        return false;
    }
    return true;
};
// GET /api/admin/dashboard
const getAdminDashboard = async (req, res) => {
    const authReq = req;
    if (!authorizeSuperAdmin(authReq, res))
        return;
    try {
        // 1. Fetch all tenants with their users and sale count
        const tenants = await prisma_1.default.tenant.findMany({
            include: {
                users: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        active: true,
                        createdAt: true,
                    }
                },
                _count: {
                    select: { sales: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        // 2. Fetch plan prices from SystemConfig
        const configPrices = await prisma_1.default.systemConfig.findMany();
        let priceStandard = 12320;
        let pricePro = 15730;
        configPrices.forEach(cfg => {
            const val = Number(cfg.value);
            if (cfg.key === 'price_standard' && !isNaN(val))
                priceStandard = val;
            if (cfg.key === 'price_pro' && !isNaN(val))
                pricePro = val;
        });
        res.json({
            tenants: tenants.map(t => ({
                id: t.id,
                name: t.name,
                email: t.email,
                phone: t.phone,
                address: t.address,
                plan: t.plan,
                subActive: t.subActive,
                subExpiresAt: t.subExpiresAt,
                createdAt: t.createdAt,
                salesCount: t._count.sales,
                users: t.users
            })),
            prices: {
                price_standard: priceStandard,
                price_pro: pricePro
            }
        });
    }
    catch (error) {
        console.error('Error fetching admin dashboard:', error);
        res.status(500).json({ message: 'Error interno del servidor al cargar el panel de administrador.' });
    }
};
exports.getAdminDashboard = getAdminDashboard;
// POST /api/admin/prices
const updatePlanPrices = async (req, res) => {
    const authReq = req;
    if (!authorizeSuperAdmin(authReq, res))
        return;
    try {
        const { price_standard, price_pro } = req.body;
        if (price_standard === undefined || price_pro === undefined) {
            return res.status(400).json({ message: 'Debe proporcionar price_standard y price_pro.' });
        }
        await prisma_1.default.$transaction([
            prisma_1.default.systemConfig.upsert({
                where: { key: 'price_standard' },
                update: { value: String(price_standard) },
                create: { key: 'price_standard', value: String(price_standard) }
            }),
            prisma_1.default.systemConfig.upsert({
                where: { key: 'price_pro' },
                update: { value: String(price_pro) },
                create: { key: 'price_pro', value: String(price_pro) }
            })
        ]);
        res.json({
            message: 'Precios actualizados exitosamente.',
            prices: {
                price_standard,
                price_pro
            }
        });
    }
    catch (error) {
        console.error('Error updating plan prices:', error);
        res.status(500).json({ message: 'Error interno del servidor al actualizar los precios.' });
    }
};
exports.updatePlanPrices = updatePlanPrices;
// POST /api/admin/tenants/:id/toggle-status
const toggleTenantStatus = async (req, res) => {
    const authReq = req;
    if (!authorizeSuperAdmin(authReq, res))
        return;
    try {
        const { id } = req.params;
        const { subActive, days, plan } = req.body;
        const tenant = await prisma_1.default.tenant.findUnique({ where: { id } });
        if (!tenant) {
            return res.status(404).json({ message: 'Comercio no encontrado.' });
        }
        const newStatus = subActive !== undefined ? subActive : !tenant.subActive;
        // Calculate new expiry if activating with a specific number of days
        let newExpiresAt;
        if (newStatus && days !== undefined) {
            const numDays = parseInt(String(days), 10);
            if (numDays > 0) {
                // If tenant already has an active sub, extend from current expiry; otherwise from now
                const baseDate = (tenant.subActive && tenant.subExpiresAt && tenant.subExpiresAt > new Date())
                    ? new Date(tenant.subExpiresAt)
                    : new Date();
                baseDate.setDate(baseDate.getDate() + numDays);
                newExpiresAt = baseDate;
            }
            // if days === 0: activate without changing expiry (manual/indefinite)
        }
        const updateData = { subActive: newStatus };
        if (plan)
            updateData.plan = plan;
        if (newExpiresAt)
            updateData.subExpiresAt = newExpiresAt;
        const updatedTenant = await prisma_1.default.tenant.update({
            where: { id },
            data: updateData
        });
        const daysMsg = newExpiresAt
            ? ` por ${days} días (hasta ${newExpiresAt.toLocaleDateString('es-AR')})`
            : '';
        res.json({
            message: `Comercio ${updatedTenant.name} ${updatedTenant.subActive ? `activado${daysMsg}` : 'desactivado'} exitosamente.`,
            tenant: {
                id: updatedTenant.id,
                subActive: updatedTenant.subActive,
                subExpiresAt: updatedTenant.subExpiresAt,
                plan: updatedTenant.plan
            }
        });
    }
    catch (error) {
        console.error('Error toggling tenant status:', error);
        res.status(500).json({ message: 'Error interno del servidor al cambiar el estado del comercio.' });
    }
};
exports.toggleTenantStatus = toggleTenantStatus;
