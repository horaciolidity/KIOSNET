-- Agregar columna para el estado del tutorial a la tabla User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN DEFAULT FALSE;
