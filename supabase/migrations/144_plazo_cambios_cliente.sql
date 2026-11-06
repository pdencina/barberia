-- 144: plazo (en horas) hasta el cual el cliente puede cancelar o modificar su cita desde el correo. Antes era fijo: 2 horas.
-- Aditiva y re-ejecutable.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS client_change_hours integer NOT NULL DEFAULT 2;

-- Verificación
SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'client_change_hours';
