-- 145: los negocios nuevos nacen con el centro de avisos (campanita) encendido. Los existentes se actualizaron aparte (7 nov. 2026).
-- Aditiva y re-ejecutable. Ya aplicada en producción y en pruebas.
ALTER TABLE tenants ALTER COLUMN notification_center_enabled SET DEFAULT true;

-- Verificación
SELECT column_default FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'notification_center_enabled';
