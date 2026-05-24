import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../utils/prisma';

// Helper to check super admin authorization
const authorizeSuperAdmin = (req: AuthenticatedRequest, res: Response): boolean => {
  const user = req.user;
  if (!user || user.email !== 'horaciowalterortiz@gmail.com') {
    res.status(403).json({ message: 'Acceso denegado. Solo el súper administrador horaciowalterortiz@gmail.com puede acceder.' });
    return false;
  }
  return true;
};

// GET /api/admin/dashboard
export const getAdminDashboard = async (req: any, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authorizeSuperAdmin(authReq, res)) return;

  try {
    // 1. Fetch all tenants with their users and sale count
    const tenants = await prisma.tenant.findMany({
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
    const configPrices = await prisma.systemConfig.findMany();
    
    let priceStandard = 12320;
    let pricePro = 15730;

    configPrices.forEach(cfg => {
      const val = Number(cfg.value);
      if (cfg.key === 'price_standard' && !isNaN(val)) priceStandard = val;
      if (cfg.key === 'price_pro' && !isNaN(val)) pricePro = val;
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
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ message: 'Error interno del servidor al cargar el panel de administrador.' });
  }
};

// POST /api/admin/prices
export const updatePlanPrices = async (req: any, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authorizeSuperAdmin(authReq, res)) return;

  try {
    const { price_standard, price_pro } = req.body;

    if (price_standard === undefined || price_pro === undefined) {
      return res.status(400).json({ message: 'Debe proporcionar price_standard y price_pro.' });
    }

    await prisma.$transaction([
      prisma.systemConfig.upsert({
        where: { key: 'price_standard' },
        update: { value: String(price_standard) },
        create: { key: 'price_standard', value: String(price_standard) }
      }),
      prisma.systemConfig.upsert({
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
  } catch (error) {
    console.error('Error updating plan prices:', error);
    res.status(500).json({ message: 'Error interno del servidor al actualizar los precios.' });
  }
};
