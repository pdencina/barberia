-- 174: pagar VARIAS citas del mismo cliente juntas desde el tótem. Aditiva y re-ejecutable.
-- kiosk_payments.appointment_id sigue siendo la primera cita; appointment_ids guarda las demás.
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS appointment_ids uuid[];

-- Verificacion: 1 columna nueva.
SELECT count(*) AS columnas_1 FROM information_schema.columns WHERE table_name='kiosk_payments' AND column_name='appointment_ids';
