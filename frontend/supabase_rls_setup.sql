-- =============================================================
-- KIOSNET - Script COMPLETO de RLS para Supabase (CORREGIDO EXACTO)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- SuperAdmin: horaciowalterortiz@gmail.com
-- FIX: Utiliza estrictamente "tenantId" con comillas dobles en cada comparación
-- =============================================================

-- =============================================================
-- PASO 1: Habilitar RLS en TODAS las tablas
-- =============================================================
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Setting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashRegister" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SystemConfig" ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- PASO 2: Eliminar TODAS las políticas anteriores
-- =============================================================
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- =============================================================
-- PASO 3: Función auxiliar para verificar si es superadmin
-- =============================================================
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email') = 'horaciowalterortiz@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- PASO 4: TABLA "Tenant"
-- =============================================================

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
    id::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Tenant: update own"
  ON "Tenant" FOR UPDATE
  TO authenticated
  USING (
    id::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

-- =============================================================
-- PASO 5: TABLA "User"
-- =============================================================

CREATE POLICY "User: superadmin full access"
  ON "User" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "User: insert on signup"
  ON "User" FOR INSERT
  TO authenticated
  WITH CHECK (id::text = auth.uid()::text);

CREATE POLICY "User: select own tenant"
  ON "User" FOR SELECT
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "User: update own"
  ON "User" FOR UPDATE
  TO authenticated
  USING (id::text = auth.uid()::text);

-- =============================================================
-- PASO 6: TABLA "Category"
-- =============================================================

CREATE POLICY "Category: superadmin full access"
  ON "Category" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "Category: insert own tenant"
  ON "Category" FOR INSERT
  TO authenticated
  WITH CHECK (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Category: select own tenant"
  ON "Category" FOR SELECT
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Category: update own tenant"
  ON "Category" FOR UPDATE
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Category: delete own tenant"
  ON "Category" FOR DELETE
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

-- =============================================================
-- PASO 7: TABLA "Setting"
-- =============================================================

CREATE POLICY "Setting: superadmin full access"
  ON "Setting" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "Setting: insert own tenant"
  ON "Setting" FOR INSERT
  TO authenticated
  WITH CHECK (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Setting: select own tenant"
  ON "Setting" FOR SELECT
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Setting: update own tenant"
  ON "Setting" FOR UPDATE
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

-- =============================================================
-- PASO 8: TABLA "Product"
-- =============================================================

CREATE POLICY "Product: superadmin full access"
  ON "Product" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "Product: insert own tenant"
  ON "Product" FOR INSERT
  TO authenticated
  WITH CHECK (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Product: select own tenant"
  ON "Product" FOR SELECT
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Product: update own tenant"
  ON "Product" FOR UPDATE
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Product: delete own tenant"
  ON "Product" FOR DELETE
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

-- =============================================================
-- PASO 9: TABLA "Sale"
-- =============================================================

CREATE POLICY "Sale: superadmin full access"
  ON "Sale" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "Sale: insert own tenant"
  ON "Sale" FOR INSERT
  TO authenticated
  WITH CHECK (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Sale: select own tenant"
  ON "Sale" FOR SELECT
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

-- =============================================================
-- PASO 10: TABLA "SaleItem"
-- =============================================================

CREATE POLICY "SaleItem: superadmin full access"
  ON "SaleItem" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "SaleItem: insert via sale"
  ON "SaleItem" FOR INSERT
  TO authenticated
  WITH CHECK (
    "saleId"::text IN (
      SELECT id::text FROM "Sale" 
      WHERE "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
    )
  );

CREATE POLICY "SaleItem: select via sale"
  ON "SaleItem" FOR SELECT
  TO authenticated
  USING (
    "saleId"::text IN (
      SELECT id::text FROM "Sale" 
      WHERE "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
    )
  );

-- =============================================================
-- PASO 11: TABLA "Customer"
-- =============================================================

CREATE POLICY "Customer: superadmin full access"
  ON "Customer" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "Customer: insert own tenant"
  ON "Customer" FOR INSERT
  TO authenticated
  WITH CHECK (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Customer: select own tenant"
  ON "Customer" FOR SELECT
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Customer: update own tenant"
  ON "Customer" FOR UPDATE
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Customer: delete own tenant"
  ON "Customer" FOR DELETE
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

-- =============================================================
-- PASO 12: TABLA "CashRegister"
-- =============================================================

CREATE POLICY "CashRegister: superadmin full access"
  ON "CashRegister" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "CashRegister: insert own tenant"
  ON "CashRegister" FOR INSERT
  TO authenticated
  WITH CHECK (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "CashRegister: select own tenant"
  ON "CashRegister" FOR SELECT
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "CashRegister: update own tenant"
  ON "CashRegister" FOR UPDATE
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

-- =============================================================
-- PASO 13: TABLA "CashMovement"
-- =============================================================

CREATE POLICY "CashMovement: superadmin full access"
  ON "CashMovement" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "CashMovement: insert own tenant"
  ON "CashMovement" FOR INSERT
  TO authenticated
  WITH CHECK (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "CashMovement: select own tenant"
  ON "CashMovement" FOR SELECT
  TO authenticated
  USING (
    "tenantId"::text IN (SELECT "tenantId"::text FROM "User" WHERE id::text = auth.uid()::text)
  );

-- =============================================================
-- PASO 14: TABLA "SystemConfig" (precios globales)
-- =============================================================

CREATE POLICY "SystemConfig: superadmin full access"
  ON "SystemConfig" FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "SystemConfig: authenticated read"
  ON "SystemConfig" FOR SELECT
  TO authenticated
  USING (true);
