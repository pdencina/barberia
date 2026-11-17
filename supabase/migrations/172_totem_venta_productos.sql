-- 172: venta de PRODUCTOS desde el totem (pago en maquina/QR/caja, con el profesional que atendio). Aditiva y re-ejecutable.
--  * kiosk_payments ahora puede ser de un producto: kind, barber_id (quien vende), client_id, items (carrito con precios del servidor).
--  * appointment_id deja de ser obligatorio (una compra de productos puede no tener cita).
ALTER TABLE kiosk_payments ALTER COLUMN appointment_id DROP NOT NULL;
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'servicio';
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS barber_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS items jsonb;
ALTER TABLE kiosk_payments DROP CONSTRAINT IF EXISTS kiosk_payments_kind_check;
ALTER TABLE kiosk_payments ADD CONSTRAINT kiosk_payments_kind_check CHECK (kind IN ('servicio','producto'));
ALTER TABLE kiosk_payments DROP CONSTRAINT IF EXISTS kiosk_payments_origen_check;
ALTER TABLE kiosk_payments ADD CONSTRAINT kiosk_payments_origen_check CHECK ((kind = 'servicio' AND appointment_id IS NOT NULL) OR (kind = 'producto' AND barber_id IS NOT NULL AND items IS NOT NULL));
CREATE INDEX IF NOT EXISTS kiosk_payments_barber_idx ON kiosk_payments (barber_id) WHERE barber_id IS NOT NULL;

-- Verificacion: columnas nuevas = 4, y ningun pago existente roto (todos de servicio con cita).
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name='kiosk_payments' AND column_name IN ('kind','barber_id','client_id','items')) AS columnas_4,
  (SELECT count(*) FROM kiosk_payments WHERE kind='servicio' AND appointment_id IS NULL) AS pagos_de_servicio_sin_cita_0;
