import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create Initial Users
  console.log('👤 Creating initial users...');
  
  const adminPassword = await bcrypt.hash('admin123', 10);
  const employeePassword = await bcrypt.hash('empleado123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@pos.com' },
    update: {},
    create: {
      email: 'admin@pos.com',
      name: 'Administrador',
      password: adminPassword,
      role: 'ADMIN',
      active: true,
    },
  });
  console.log(`✅ Admin user created/verified: ${admin.email}`);

  const employee = await prisma.user.upsert({
    where: { email: 'empleado@pos.com' },
    update: {},
    create: {
      email: 'empleado@pos.com',
      name: 'Cajero / Empleado',
      password: employeePassword,
      role: 'EMPLOYEE',
      active: true,
    },
  });
  console.log(`✅ Employee user created/verified: ${employee.email}`);

  // 2. Create Categories
  console.log('📦 Creating product categories...');
  const categories = [
    { name: 'Bebidas' },
    { name: 'Panadería' },
    { name: 'Lácteos' },
    { name: 'Cigarrillos' },
    { name: 'Fiambrería' },
    { name: 'Otros' },
  ];

  const dbCategories = [];
  for (const cat of categories) {
    const category = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    dbCategories.push(category);
    console.log(`✅ Category created/verified: ${category.name}`);
  }

  // 3. Create Sample Products
  console.log('🏷️ Creating sample products...');
  
  const beverages = dbCategories.find(c => c.name === 'Bebidas');
  const bakery = dbCategories.find(c => c.name === 'Panadería');
  const dairy = dbCategories.find(c => c.name === 'Lácteos');

  if (beverages) {
    await prisma.product.upsert({
      where: { barcode: '779007041853' },
      update: {},
      create: {
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
      },
    });
    
    await prisma.product.upsert({
      where: { barcode: '779007041854' },
      update: {},
      create: {
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
      },
    });
  }

  if (bakery) {
    await prisma.product.upsert({
      where: { barcode: '779006020584' },
      update: {},
      create: {
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
      },
    });
  }

  if (dairy) {
    await prisma.product.upsert({
      where: { barcode: '779008002634' },
      update: {},
      create: {
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
      },
    });
  }

  // 4. Create default Settings
  console.log('⚙️ Creating default settings...');
  const settings = [
    { key: 'business_name', value: 'KIOSNET POS' },
    { key: 'business_address', value: 'Av. Corrientes 1234, CABA' },
    { key: 'business_phone', value: '+54 9 11 1234-5678' },
    { key: 'business_cuit', value: '20-12345678-9' },
    { key: 'business_currency', value: 'ARS' },
  ];

  for (const set of settings) {
    await prisma.setting.upsert({
      where: { key: set.key },
      update: {},
      create: set,
    });
  }
  console.log('✅ Default settings created/verified.');

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
