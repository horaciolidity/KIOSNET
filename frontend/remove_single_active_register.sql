-- KIOSNET - Eliminar restricción de una sola caja abierta por comercio
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query

DROP INDEX IF EXISTS "unique_active_register_per_tenant";
