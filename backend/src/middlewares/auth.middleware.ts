import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'EMPLOYEE';
    tenantId: string;
    plan: string;
    subActive: boolean;
    subExpiresAt?: Date | null;
  };
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No autorizado. Token faltante.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this') as {
      id: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { tenant: true },
    });

    if (!user || !user.active) {
      return res.status(401).json({ message: 'Usuario no encontrado o inactivo.' });
    }

    let subActive = user.tenant.subActive;
    if (subActive && user.tenant.subExpiresAt && user.tenant.subExpiresAt < new Date()) {
      // Auto-expire subscription dynamically in DB
      await prisma.tenant.update({
        where: { id: user.tenantId },
        data: { subActive: false }
      });
      subActive = false;
    }

    (req as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'ADMIN' | 'EMPLOYEE',
      tenantId: user.tenantId,
      plan: user.tenant.plan,
      subActive: subActive,
      subExpiresAt: user.tenant.subExpiresAt,
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Sesión inválida o expirada.' });
  }
};
