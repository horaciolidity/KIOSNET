import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../utils/prisma';

export const getProducts = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const products = await prisma.product.findMany({
      where: { 
        active: true,
        tenantId 
      },
      include: { category: true }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos' });
  }
};

export const createProduct = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { name, barcode, categoryId, costPrice, sellingPrice, stock, minStock, unit } = req.body;

    if (!name || !categoryId || costPrice === undefined || sellingPrice === undefined) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    // Check barcode uniqueness only within the active tenant
    if (barcode) {
      const existing = await prisma.product.findFirst({
        where: { barcode, tenantId }
      });
      if (existing) {
        return res.status(400).json({ message: 'Ya tienes un producto registrado con este código de barras' });
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        barcode: barcode || null,
        categoryId,
        costPrice: Number(costPrice),
        sellingPrice: Number(sellingPrice),
        stock: stock !== undefined ? Number(stock) : 0,
        minStock: minStock !== undefined ? Number(minStock) : 5,
        unit: unit || 'UNIDAD',
        tenantId
      }
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear producto' });
  }
};

export const updateStock = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { id } = req.params as { id: string };
    const { quantity } = req.body;

    // Verify ownership
    const existing = await prisma.product.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Producto no encontrado en tu comercio' });
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        stock: {
          increment: Number(quantity)
        }
      }
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar stock' });
  }
};

export const updateProduct = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { id } = req.params as { id: string };
    const { name, barcode, categoryId, costPrice, sellingPrice, stock, minStock, unit, active } = req.body;

    // Verify ownership
    const existing = await prisma.product.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Producto no encontrado en tu comercio' });
    }

    // Verify barcode uniqueness within the tenant
    if (barcode && barcode !== existing.barcode) {
      const barcodeExists = await prisma.product.findFirst({
        where: { barcode, tenantId, id: { not: id } }
      });
      if (barcodeExists) {
        return res.status(400).json({ message: 'Ya tienes otro producto registrado con este código de barras' });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        barcode: barcode || null,
        categoryId,
        costPrice: costPrice !== undefined ? Number(costPrice) : undefined,
        sellingPrice: sellingPrice !== undefined ? Number(sellingPrice) : undefined,
        stock: stock !== undefined ? Number(stock) : undefined,
        minStock: minStock !== undefined ? Number(minStock) : undefined,
        unit,
        active
      }
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar producto' });
  }
};

export const deleteProduct = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { id } = req.params as { id: string };

    // Verify ownership
    const existing = await prisma.product.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Producto no encontrado en tu comercio' });
    }

    // Soft delete to protect database sales history reference integrity
    const product = await prisma.product.update({
      where: { id },
      data: { active: false }
    });

    res.json({ message: 'Producto eliminado exitosamente', product });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar producto' });
  }
};
