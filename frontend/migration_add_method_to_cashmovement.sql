-- =============================================================
-- KIOSNET - Migración: Agregar columna "method" a CashMovement
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- =============================================================

-- Agregar columna method con valor por defecto EFECTIVO (para no romper registros existentes)
ALTER TABLE "CashMovement"
  ADD COLUMN IF NOT EXISTS "method" TEXT NOT NULL DEFAULT 'EFECTIVO';

-- Verificar que se creó correctamente
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'CashMovement' AND column_name = 'method';
