import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener notificaciones' });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.notification.update({
      where: { id },
      data: { read: true }
    });
    res.json({ message: 'Notificación leída' });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar notificación' });
  }
};
