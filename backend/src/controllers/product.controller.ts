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
    const { id } = req.params;
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
