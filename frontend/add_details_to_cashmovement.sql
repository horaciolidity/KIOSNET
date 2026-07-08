-- KIOSNET - Migración: Agregar columna details a CashMovement
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query

ALTER TABLE "CashMovement"
  ADD COLUMN IF NOT EXISTS "details" JSONB DEFAULT NULL;
