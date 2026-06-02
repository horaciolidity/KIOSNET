-- =============================================================
-- KIOSNET - Diagnóstico: ¿Por qué da 404?
-- El problema: el usuario auth NO tiene perfil en tabla "User"
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- =============================================================

-- PASO 1: Ver todos los usuarios en Supabase Auth
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 20;

-- PASO 2: Ver todos los perfiles en tabla "User"
SELECT 
  id,
  email,
  name,
  role,
  "tenantId"
FROM "User"
ORDER BY "createdAt" DESC
LIMIT 20;

-- PASO 3: Encontrar usuarios de Auth que NO tienen perfil en "User"
-- (estos son los que causan los 404)
SELECT 
  au.id AS auth_id,
  au.email AS auth_email,
  u.id AS user_profile_id,
  u."tenantId"
FROM auth.users au
LEFT JOIN "User" u ON u.id::text = au.id::text
WHERE u.id IS NULL;

-- PASO 4: Ver a qué tenant pertenece cada usuario
SELECT 
  u.id,
  u.email,
  u.role,
  u."tenantId",
  t.name AS tenant_name,
  t.plan,
  t."subActive"
FROM "User" u
LEFT JOIN "Tenant" t ON t.id::text = u."tenantId"::text
ORDER BY u."createdAt" DESC;
