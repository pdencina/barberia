-- 168: cobro con tarjeta en la MAQUINA del local desde el totem (Mercado Pago Point o TUU). Aditiva y re-ejecutable.
--  * tenants.kiosk_terminal_enabled: interruptor por negocio, APAGADO por defecto.
--  * kiosk_payments: ahora tambien registra cobros en maquina (method/provider/external_id/device/checked_at) y el estado 'cancelled'.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kiosk_terminal_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'qr';
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS device text;
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS checked_at timestamptz;

ALTER TABLE kiosk_payments DROP CONSTRAINT IF EXISTS kiosk_payments_status_check;
ALTER TABLE kiosk_payments ADD CONSTRAINT kiosk_payments_status_check CHECK (status IN ('pending','paid','failed','expired','cancelled'));
CREATE INDEX IF NOT EXISTS kiosk_payments_terminal_idx ON kiosk_payments (tenant_id, method, status, created_at DESC);

-- Verificacion: interruptor = 1, columnas nuevas = 5.
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name='tenants' AND column_name='kiosk_terminal_enabled') AS interruptor_1,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='kiosk_payments' AND column_name IN ('method','provider','external_id','device','checked_at')) AS columnas_5;
