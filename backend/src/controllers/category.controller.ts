import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../utils/prisma';

export const getCategories = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const categories = await prisma.category.findMany({
      where: { tenantId },
      include: { 
        _count: { 
          select: { products: true } 
        } 
      }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener categorías' });
  }
};

export const createCategory = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'El nombre es obligatorio' });
    }

    // Check localized uniqueness for this tenant only
    const existing = await prisma.category.findFirst({
      where: { name, tenantId }
    });

    if (existing) {
      return res.status(400).json({ message: 'La categoría ya existe en tu comercio' });
    }

    const category = await prisma.category.create({
      data: { 
        name,
        tenantId
      }
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear categoría' });
  }
};
