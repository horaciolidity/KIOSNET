-- =============================================================
-- KIOSNET - Migración: Agregar paymentMethod y profit a CashMovement
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- =============================================================

-- 1. Agregar campo paymentMethod a CashMovement (si no existe)
ALTER TABLE "CashMovement"
  ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT DEFAULT 'EFECTIVO';

-- 2. Agregar campo profit a CashMovement (si no existe)  
ALTER TABLE "CashMovement"
  ADD COLUMN IF NOT EXISTS "profit" NUMERIC DEFAULT NULL;

-- 3. Agregar campo tenantId a CashMovement (para RLS directo)
ALTER TABLE "CashMovement"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT DEFAULT NULL;

-- 4. Poblar tenantId desde el CashRegister relacionado (para registros existentes)
UPDATE "CashMovement" cm
SET "tenantId" = cr."tenantId"
FROM "CashRegister" cr
WHERE cm."registerId" = cr.id
  AND cm."tenantId" IS NULL;

-- 5. Actualizar movimientos de ventas existentes con su paymentMethod 
--    basándose en la descripción (retrocompatibilidad básica)
UPDATE "CashMovement"
SET "paymentMethod" = 'EFECTIVO'
WHERE "paymentMethod" IS NULL OR "paymentMethod" = '';

-- 6. Ver resultado
SELECT 
  id, 
  description, 
  type,
  "paymentMethod",
  amount,
  profit,
  "tenantId"
FROM "CashMovement"
ORDER BY "createdAt" DESC
LIMIT 20;
