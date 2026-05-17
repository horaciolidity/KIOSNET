import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true },
      where: { active: true }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos' });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { name, barcode, categoryId, costPrice, sellingPrice, stock, minStock, unit } = req.body;
    
    const product = await prisma.product.create({
      data: {
        name,
        barcode,
        categoryId,
        costPrice,
        sellingPrice,
        stock,
        minStock,
        unit
      }
    });
    
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear producto' });
  }
};

export const updateStock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { quantity } = req.body;
    
    const product = await prisma.product.update({
      where: { id },
      data: {
        stock: {
          increment: quantity
        }
      }
    });
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar stock' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { name, barcode, categoryId, costPrice, sellingPrice, stock, minStock, unit, active } = req.body;
    
    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        barcode,
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

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    
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
