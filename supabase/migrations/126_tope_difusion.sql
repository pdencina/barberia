-- Tope mensual de correos de DIFUSION (campañas de retención) por negocio. Aditiva y re-ejecutable.
-- El valor por defecto (350) vive en el codigo (src/lib/message-quota.ts, TOPE_DIFUSION_CORREOS).
--   NULL        = usa el tope por defecto (350 al mes)
--   un numero   = ese tope para el negocio
--   -1 (negativo) = sin tope (para Estudio Levels)
-- Se prueba primero en Supabase "rebooking Base" (pruebas). El codigo tolera que esta columna falte (rige el 350 para todos),
-- pero entonces Estudio Levels tambien quedaria con tope: correr este SQL ANTES de desplegar.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS broadcast_email_quota_override INT;

-- Verificacion (debe devolver la columna):
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name = 'broadcast_email_quota_override';

-- PASO APARTE, solo en produccion y con respaldo: dejar a Estudio Levels sin tope.
-- 1) Mira primero que negocio es (debe salir UNA sola fila, la de Estudio Levels):
--    SELECT id, name, plan FROM tenants WHERE name ILIKE 'Estudio Levels%';
-- 2) Si es el correcto, con ese id:
--    UPDATE tenants SET broadcast_email_quota_override = -1 WHERE id = '<id de Estudio Levels>';
