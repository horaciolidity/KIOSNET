import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../utils/prisma';

export const getCustomers = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const customers = await prisma.customer.findMany({
      where: { tenantId },
      include: { sales: true },
      orderBy: { name: 'asc' }
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener clientes' });
  }
};

export const createCustomer = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { name, phone, address, creditLimit } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'El nombre es obligatorio' });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        address,
        creditLimit: creditLimit ? Number(creditLimit) : 0,
        tenantId
      }
    });

    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear cliente' });
  }
};

export const getCustomerBalance = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { id } = req.params as { id: string };

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId },
      select: { balance: true, creditLimit: true }
    });

    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado en tu comercio' });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener balance' });
  }
};

export const updateCustomer = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { id } = req.params as { id: string };
    const { name, phone, address, creditLimit, balance } = req.body;

    // Verify ownership
    const existing = await prisma.customer.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Cliente no encontrado en tu comercio' });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        phone,
        address,
        creditLimit: creditLimit !== undefined ? Number(creditLimit) : undefined,
        balance: balance !== undefined ? Number(balance) : undefined
      }
    });

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar cliente' });
  }
};

export const deleteCustomer = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { id } = req.params as { id: string };

    // Verify ownership
    const existing = await prisma.customer.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Cliente no encontrado en tu comercio' });
    }

    await prisma.customer.delete({
      where: { id }
    });

    res.json({ message: 'Cliente eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar cliente' });
  }
};
