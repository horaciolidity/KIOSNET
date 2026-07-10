-- KIOSNET - Migración: Restringir a una sola caja abierta ('OPEN') por comercio (tenant)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query

CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_register_per_tenant"
ON "CashRegister" ("tenantId")
WHERE ("status" = 'OPEN');
