import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'El correo y la contraseña son requeridos' });
    }

    // 1. Check if user exists
    let user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true }
    });

    let autoRegistered = false;

    if (!user) {
      // 2. AUTO-REGISTRATION: User does not exist, provision tenant + admin account on the fly!
      console.log(`Auto-registrando nuevo comercio y administrador para: ${email}`);
      const storeName = `Comercio de ${email.split('@')[0]}`;
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await prisma.$transaction(async (tx) => {
        // Create Tenant
        const newTenant = await tx.tenant.create({
          data: {
            name: storeName,
            plan: 'PRO',
            subActive: false, // Needs subscription activation!
          }
        });

        // Create Admin User
        const newUser = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name: email.split('@')[0],
            role: 'ADMIN',
            active: true,
            tenantId: newTenant.id
          }
        });

        // Seed default Categories
        await tx.category.createMany({
          data: [
            { name: 'General', tenantId: newTenant.id },
            { name: 'Bebidas', tenantId: newTenant.id },
            { name: 'Comestibles', tenantId: newTenant.id }
          ]
        });

        // Seed default Settings
        await tx.setting.createMany({
          data: [
            { key: 'business_name', value: storeName, tenantId: newTenant.id },
            { key: 'business_phone', value: '', tenantId: newTenant.id },
            { key: 'business_address', value: '', tenantId: newTenant.id },
            { key: 'business_tax_id', value: '', tenantId: newTenant.id },
            { key: 'mercado_pago_active', value: 'false', tenantId: newTenant.id }
          ]
        });

        return { tenant: newTenant, user: newUser };
      });

      // Retrieve full newly created user object
      user = await prisma.user.findUnique({
        where: { id: result.user.id },
        include: { tenant: true }
      });
      autoRegistered = true;
    } else {
      // 3. STANDARD LOGIN: User exists, verify credentials
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Contraseña incorrecta' });
      }
    }

    if (!user || !user.active) {
      return res.status(401).json({ message: 'Esta cuenta se encuentra inactiva' });
    }

    // 4. Issue JWT Access Token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this',
      { expiresIn: '1d' }
    );

    const salesCount = await prisma.sale.count({
      where: { tenantId: user.tenantId }
    });

    res.json({
      message: autoRegistered 
        ? '¡Comercio creado y registrado con éxito!' 
        : 'Sesión iniciada correctamente',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        plan: user.tenant.plan,
        subActive: user.tenant.subActive,
        salesCount: salesCount
      },
      token,
      autoRegistered
    });
  } catch (error: any) {
    console.error('Error in login auto-registration:', error);
    res.status(500).json({ message: 'Error en el servidor al procesar el inicio de sesión', error: error.message });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, storeName } = req.body;

    if (!email || !password || !name || !storeName) {
      return res.status(400).json({ message: 'Todos los campos son requeridos (email, password, name, storeName)' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: storeName,
          plan: 'PRO',
          subActive: false,
        }
      });

      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'ADMIN',
          tenantId: tenant.id
        }
      });

      await tx.category.createMany({
        data: [
          { name: 'General', tenantId: tenant.id },
          { name: 'Bebidas', tenantId: tenant.id },
          { name: 'Comestibles', tenantId: tenant.id }
        ]
      });

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
      message: 'Comercio registrado exitosamente.',
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        tenantId: result.user.tenantId,
        plan: result.tenant.plan,
        subActive: result.tenant.subActive,
        salesCount: 0
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

    const salesCount = await prisma.sale.count({
      where: { tenantId: user.tenantId }
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        plan: user.tenant.plan,
        subActive: user.tenant.subActive,
        salesCount: salesCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor al obtener el perfil' });
  }
};
