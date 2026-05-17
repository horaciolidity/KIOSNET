import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create a Default Demo Tenant (Comercio)
  console.log('🏢 Creating demo tenant...');
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Comercio Demostrativo',
      plan: 'PRO',
      subActive: true, // Mark active for demo testing
      address: 'Av. Corrientes 1234, CABA',
      phone: '+54 9 11 1234-5678',
      taxId: '20-12345678-9',
      email: 'demo@kiosnet.com'
    }
  });
  console.log(`✅ Demo tenant created with ID: ${tenant.id}`);

  // 2. Create Initial Users tied to this Tenant
  console.log('👤 Creating initial users...');
  const adminPassword = await bcrypt.hash('admin123', 10);
  const employeePassword = await bcrypt.hash('empleado123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@pos.com',
      name: 'Administrador',
      password: adminPassword,
      role: 'ADMIN',
      active: true,
      tenantId: tenant.id
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  const employee = await prisma.user.create({
    data: {
      email: 'empleado@pos.com',
      name: 'Cajero / Empleado',
      password: employeePassword,
      role: 'EMPLOYEE',
      active: true,
      tenantId: tenant.id
    },
  });
  console.log(`✅ Employee user created: ${employee.email}`);

  // 3. Create Categories
  console.log('📦 Creating product categories...');
  const categories = [
    { name: 'Bebidas', tenantId: tenant.id },
    { name: 'Panadería', tenantId: tenant.id },
    { name: 'Lácteos', tenantId: tenant.id },
    { name: 'Cigarrillos', tenantId: tenant.id },
    { name: 'Fiambrería', tenantId: tenant.id },
    { name: 'Otros', tenantId: tenant.id },
  ];

  const dbCategories = [];
  for (const cat of categories) {
    const category = await prisma.category.create({
      data: cat
    });
    dbCategories.push(category);
    console.log(`✅ Category created: ${category.name}`);
  }

  // 4. Create Sample Products
  console.log('🏷️ Creating sample products...');
  const beverages = dbCategories.find(c => c.name === 'Bebidas');
  const bakery = dbCategories.find(c => c.name === 'Panadería');
  const dairy = dbCategories.find(c => c.name === 'Lácteos');

  if (beverages) {
    await prisma.product.create({
      data: {
        name: 'Coca Cola 1.5L',
        barcode: '779007041853',
        description: 'Bebida gaseosa refrescante sabor original',
        categoryId: beverages.id,
        unit: 'UNIDAD',
        costPrice: 1800,
        sellingPrice: 2500,
        stock: 50,
        minStock: 10,
        active: true,
        tenantId: tenant.id
      },
    });
    
    await prisma.product.create({
      data: {
        name: 'Agua Mineral Villavicencio 2L',
        barcode: '779007041854',
        description: 'Agua mineral natural de manantial',
        categoryId: beverages.id,
        unit: 'UNIDAD',
        costPrice: 1000,
        sellingPrice: 1500,
        stock: 30,
        minStock: 8,
        active: true,
        tenantId: tenant.id
      },
    });
  }

  if (bakery) {
    await prisma.product.create({
      data: {
        name: 'Pan Lactal Bimbo Grande',
        barcode: '779006020584',
        description: 'Pan de mesa lactal familiar',
        categoryId: bakery.id,
        unit: 'UNIDAD',
        costPrice: 2200,
        sellingPrice: 3100,
        stock: 15,
        minStock: 5,
        active: true,
        tenantId: tenant.id
      },
    });
  }

  if (dairy) {
    await prisma.product.create({
      data: {
        name: 'Leche La Serenísima 1L',
        barcode: '779008002634',
        description: 'Leche entera ultrapasteurizada',
        categoryId: dairy.id,
        unit: 'UNIDAD',
        costPrice: 1200,
        sellingPrice: 1700,
        stock: 25,
        minStock: 10,
        active: true,
        tenantId: tenant.id
      },
    });
  }

  // 5. Create default Settings
  console.log('⚙️ Creating default settings...');
  const settings = [
    { key: 'business_name', value: 'Comercio Demostrativo', tenantId: tenant.id },
    { key: 'business_address', value: 'Av. Corrientes 1234, CABA', tenantId: tenant.id },
    { key: 'business_phone', value: '+54 9 11 1234-5678', tenantId: tenant.id },
    { key: 'business_tax_id', value: '20-12345678-9', tenantId: tenant.id },
    { key: 'mercado_pago_active', value: 'false', tenantId: tenant.id },
  ];

  for (const set of settings) {
    await prisma.setting.create({
      data: set
    });
  }
  console.log('✅ Default settings created.');

  console.log('🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
