import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const createSale = async (req: Request, res: Response) => {
  try {
    const { 
      total, 
      subtotal, 
      discount, 
      paymentMethod, 
      customerId, 
      sellerId, 
      items,
      receivedAmount,
      changeAmount
    } = req.body;

    // Use a transaction to ensure all operations succeed or fail together
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Create the sale
      const newSale = await tx.sale.create({
        data: {
          total,
          subtotal,
          discount,
          paymentMethod,
          customerId,
          sellerId,
          receivedAmount,
          changeAmount,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              costPrice: item.costPrice
            }))
          }
        }
      });

      // 2. Update stock for each item
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        });
      }

      // 3. If it's a credit sale, update customer balance
      if (paymentMethod === 'CREDIT' && customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            balance: {
              increment: total
            }
          }
        });
      }

      return newSale;
    });

    res.status(201).json(sale);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al procesar la venta' });
  }
};

export const getSales = async (req: Request, res: Response) => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        items: { include: { product: true } },
        customer: true,
        seller: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener ventas' });
  }
};

export const getSaleStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const sale = await prisma.sale.findUnique({
      where: { id },
      select: { status: true }
    });
    
    if (!sale) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }
    
    res.json({ status: sale.status });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estado de la venta' });
  }
};
