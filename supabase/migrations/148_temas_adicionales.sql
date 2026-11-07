-- Amplía las opciones personales sin cambiar ninguna preferencia existente.
-- Ejecutar primero en rebooking Base (pruebas), luego en EstudioLevels.
BEGIN;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_theme_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_theme_check
  CHECK (theme IS NULL OR theme IN ('light', 'dark', 'rose', 'monochrome', 'monochrome-dark'));
COMMIT;
-- Verificación: debe incluir los cinco nombres; no cambia filas de negocios.
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_theme_check';
