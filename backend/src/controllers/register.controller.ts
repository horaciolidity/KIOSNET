import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const openRegister = async (req: Request, res: Response) => {
  try {
    const { userId, openingBalance, notes } = req.body;

    const existingOpen = await prisma.cashRegister.findFirst({
      where: { userId, status: 'OPEN' }
    });

    if (existingOpen) {
      return res.status(400).json({ message: 'Ya tienes una caja abierta' });
    }

    const register = await prisma.cashRegister.create({
      data: {
        userId,
        openingBalance,
        notes,
        status: 'OPEN'
      }
    });

    res.status(201).json(register);
  } catch (error) {
    res.status(500).json({ message: 'Error al abrir caja' });
  }
};

export const closeRegister = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { closingBalance, notes } = req.body;

    const register = await prisma.cashRegister.update({
      where: { id },
      data: {
        closingBalance,
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

export const getMovements = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const movements = await prisma.cashMovement.findMany({
      where: { registerId: id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener movimientos' });
  }
};

export const addMovement = async (req: Request, res: Response) => {
  try {
    const { registerId, amount, type, description } = req.body;
    
    const movement = await prisma.cashMovement.create({
      data: {
        registerId,
        amount,
        type,
        description
      }
    });
    
    res.status(201).json(movement);
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar movimiento' });
  }
};
