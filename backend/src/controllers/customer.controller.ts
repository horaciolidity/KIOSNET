import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      include: { sales: true },
      orderBy: { name: 'asc' }
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener clientes' });
  }
};

export const createCustomer = async (req: Request, res: Response) => {
  try {
    const { name, phone, address, creditLimit } = req.body;
    
    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        address,
        creditLimit: creditLimit || 0
      }
    });
    
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear cliente' });
  }
};

export const getCustomerBalance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { balance: true, creditLimit: true }
    });
    
    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener balance' });
  }
};
