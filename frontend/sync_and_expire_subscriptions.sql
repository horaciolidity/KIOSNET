-- ====================================================================
-- KIOSNET: Procedimiento / Trigger para caducidad automática de suscripciones
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- ====================================================================

-- 1. Función para desactivar comercios con fecha de vencimiento cumplida
CREATE OR REPLACE FUNCTION expire_overdue_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE "Tenant"
  SET "subActive" = false
  WHERE "subActive" = true
    AND "subExpiresAt" IS NOT NULL
    AND "subExpiresAt" <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ejecución inmediata de prueba / sincronización
SELECT expire_overdue_subscriptions();

