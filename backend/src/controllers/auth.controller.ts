import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true }
    });

    if (!user || !user.active) {
      return res.status(401).json({ message: 'Credenciales inválidas o cuenta inactiva' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this',
      { expiresIn: '1d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        plan: user.tenant.plan,
        subActive: user.tenant.subActive,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor al iniciar sesión' });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, storeName } = req.body;

    if (!email || !password || !name || !storeName) {
      return res.status(400).json({ message: 'Todos los campos son requeridos (email, password, name, storeName)' });
    }

    // Check if the user email is already registered globally
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Perform database operations in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create a new isolated Tenant (Comercio)
      const tenant = await tx.tenant.create({
        data: {
          name: storeName,
          plan: 'PRO',
          subActive: false, // Starts as inactive; requires subscription payment!
        }
      });

      // 2. Create the Admin user for this Tenant
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'ADMIN',
          tenantId: tenant.id
        }
      });

      // 3. Seed default Categories for this Tenant
      await tx.category.createMany({
        data: [
          { name: 'General', tenantId: tenant.id },
          { name: 'Bebidas', tenantId: tenant.id },
          { name: 'Comestibles', tenantId: tenant.id }
        ]
      });

      // 4. Seed default Settings for this Tenant
      await tx.setting.createMany({
        data: [
          { key: 'business_name', value: storeName, tenantId: tenant.id },
          { key: 'business_phone', value: '', tenantId: tenant.id },
          { key: 'business_address', value: '', tenantId: tenant.id },
          { key: 'business_tax_id', value: '', tenantId: tenant.id },
          { key: 'mercado_pago_active', value: 'false', tenantId: tenant.id }
        ]
      });

      return { tenant, user };
    });

    res.status(201).json({
      message: 'Comercio registrado exitosamente. Por favor, activa tu cuenta.',
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        tenantId: result.user.tenantId,
        plan: result.tenant.plan,
        subActive: result.tenant.subActive,
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor al registrar el comercio' });
  }
};

export const getCurrentUser = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        plan: user.tenant.plan,
        subActive: user.tenant.subActive,
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor al obtener el perfil' });
  }
};
