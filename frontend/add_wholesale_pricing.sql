-- Migración: Agregar precio diferenciado por mayor a la tabla de productos
ALTER TABLE "Product" 
ADD COLUMN IF NOT EXISTS "wholesalePrice" NUMERIC(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS "wholesaleMinQty" INTEGER DEFAULT NULL;
