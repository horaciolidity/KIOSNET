import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../utils/prisma';

export const openRegister = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { userId, openingBalance, notes } = req.body;

    const existingOpen = await prisma.cashRegister.findFirst({
      where: { userId, status: 'OPEN', tenantId }
    });

    if (existingOpen) {
      return res.status(400).json({ message: 'Ya tienes una caja abierta en tu comercio' });
    }

    const register = await prisma.cashRegister.create({
      data: {
        userId,
        openingBalance: Number(openingBalance),
        notes,
        status: 'OPEN',
        tenantId
      }
    });

    res.status(201).json(register);
  } catch (error) {
    res.status(500).json({ message: 'Error al abrir caja' });
  }
};

export const closeRegister = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { id } = req.params as { id: string };
    const { closingBalance, notes } = req.body;

    // Verify ownership
    const existing = await prisma.cashRegister.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Caja no encontrada en tu comercio' });
    }

    const register = await prisma.cashRegister.update({
      where: { id },
      data: {
        closingBalance: Number(closingBalance),
        notes,
        status: 'CLOSED',
        closedAt: new Date()
      }
    });

    res.json(register);
  } catch (error) {
    res.status(500).json({ message: 'Error al cerrar caja' });
  }
};

export const getMovements = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { id } = req.params as { id: string };

    // Verify ownership of the register
    const register = await prisma.cashRegister.findFirst({
      where: { id, tenantId }
    });

    if (!register) {
      return res.status(404).json({ message: 'Caja no encontrada en tu comercio' });
    }

    const movements = await prisma.cashMovement.findMany({
      where: { registerId: id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener movimientos' });
  }
};

export const addMovement = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { registerId, amount, type, description } = req.body;

    // Verify register ownership
    const register = await prisma.cashRegister.findFirst({
      where: { id: registerId, tenantId }
    });

    if (!register) {
      return res.status(404).json({ message: 'Caja no encontrada en tu comercio' });
    }

    const movement = await prisma.cashMovement.create({
      data: {
        registerId,
        amount: Number(amount),
        type,
        description
      }
    });

    res.status(201).json(movement);
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar movimiento' });
  }
};

export const getActiveRegister = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { userId } = req.params as { userId: string };

    const register = await prisma.cashRegister.findFirst({
      where: { userId, status: 'OPEN', tenantId },
      include: { movements: true }
    });

    res.json(register);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener caja activa' });
  }
};
