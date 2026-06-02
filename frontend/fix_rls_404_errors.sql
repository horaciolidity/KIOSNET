-- =============================================================
-- KIOSNET - FIX para errores 404 en CashRegister, CashMovement y User
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- =============================================================
-- Los errores 404 ocurren cuando RLS bloquea filas y devuelve
-- "recurso no encontrado" en lugar de un array vacío.
-- =============================================================

-- PASO 1: Verificar qué políticas existen actualmente
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('CashRegister', 'CashMovement', 'User', 'Tenant')
ORDER BY tablename, policyname;

-- =============================================================
-- PASO 2: Asegurarse que las funciones auxiliares existen
-- =============================================================
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email') = 'horaciowalterortiz@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS text AS $$
DECLARE
  tid text;
BEGIN
  SELECT "tenantId"::text INTO tid FROM "User" WHERE id = auth.uid();
  RETURN tid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- PASO 3: Habilitar RLS (si no está habilitado)
-- =============================================================
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashRegister" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- PASO 4: Recrear políticas para "User"
-- =============================================================
DROP POLICY IF EXISTS "User: superadmin full access" ON "User";
DROP POLICY IF EXISTS "User: insert on signup" ON "User";
DROP POLICY IF EXISTS "User: select own tenant" ON "User";
DROP POLICY IF EXISTS "User: update own" ON "User";

CREATE POLICY "User: superadmin full access"
  ON "User" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Permite al usuario ver su propio perfil Y los de su mismo tenant
CREATE POLICY "User: select own tenant"
  ON "User" FOR SELECT
  TO authenticated
  USING (
    id::text = auth.uid()::text
    OR
    "tenantId"::text = get_user_tenant_id()
  );

CREATE POLICY "User: insert on signup"
  ON "User" FOR INSERT
  TO authenticated
  WITH CHECK (id::text = auth.uid()::text);

CREATE POLICY "User: update own"
  ON "User" FOR UPDATE
  TO authenticated
  USING (id::text = auth.uid()::text);

-- =============================================================
-- PASO 5: Recrear políticas para "CashRegister"
-- =============================================================
DROP POLICY IF EXISTS "CashRegister: superadmin full access" ON "CashRegister";
DROP POLICY IF EXISTS "CashRegister: insert own tenant" ON "CashRegister";
DROP POLICY IF EXISTS "CashRegister: select own tenant" ON "CashRegister";
DROP POLICY IF EXISTS "CashRegister: update own tenant" ON "CashRegister";

CREATE POLICY "CashRegister: superadmin full access"
  ON "CashRegister" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "CashRegister: insert own tenant"
  ON "CashRegister" FOR INSERT
  TO authenticated
  WITH CHECK (
    "tenantId"::text = get_user_tenant_id()
  );

CREATE POLICY "CashRegister: select own tenant"
  ON "CashRegister" FOR SELECT
  TO authenticated
  USING (
    "tenantId"::text = get_user_tenant_id()
  );

CREATE POLICY "CashRegister: update own tenant"
  ON "CashRegister" FOR UPDATE
  TO authenticated
  USING (
    "tenantId"::text = get_user_tenant_id()
  );

-- =============================================================
-- PASO 6: Recrear políticas para "CashMovement"
-- =============================================================
DROP POLICY IF EXISTS "CashMovement: superadmin full access" ON "CashMovement";
DROP POLICY IF EXISTS "CashMovement: insert own tenant" ON "CashMovement";
DROP POLICY IF EXISTS "CashMovement: select own tenant" ON "CashMovement";

CREATE POLICY "CashMovement: superadmin full access"
  ON "CashMovement" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "CashMovement: insert own tenant"
  ON "CashMovement" FOR INSERT
  TO authenticated
  WITH CHECK (
    "tenantId"::text = get_user_tenant_id()
  );

-- SELECT por tenantId directo (más eficiente que JOIN)
CREATE POLICY "CashMovement: select own tenant"
  ON "CashMovement" FOR SELECT
  TO authenticated
  USING (
    "tenantId"::text = get_user_tenant_id()
  );

-- =============================================================
-- PASO 7: Asegurar que paymentNotification existe en Tenant
-- =============================================================
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paymentNotification" JSONB DEFAULT NULL;

-- Recrear políticas para Tenant
DROP POLICY IF EXISTS "Tenant: superadmin full access" ON "Tenant";
DROP POLICY IF EXISTS "Tenant: insert on signup" ON "Tenant";
DROP POLICY IF EXISTS "Tenant: select own" ON "Tenant";
DROP POLICY IF EXISTS "Tenant: update own" ON "Tenant";

CREATE POLICY "Tenant: superadmin full access"
  ON "Tenant" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "Tenant: insert on signup"
  ON "Tenant" FOR INSERT
  TO authenticated
  WITH CHECK (NOT is_superadmin());

CREATE POLICY "Tenant: select own"
  ON "Tenant" FOR SELECT
  TO authenticated
  USING (
    id::text = get_user_tenant_id()
  );

CREATE POLICY "Tenant: update own"
  ON "Tenant" FOR UPDATE
  TO authenticated
  USING (
    id::text = get_user_tenant_id()
  );

-- =============================================================
-- PASO 8: Verificar el estado final
-- =============================================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('CashRegister', 'CashMovement', 'User', 'Tenant')
ORDER BY tablename, policyname;
