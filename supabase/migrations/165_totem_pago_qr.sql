-- 165: pago por QR desde el celular en el totem (opcion A: solo avisa y marca, NO crea la venta). Aditiva y re-ejecutable.
--  * tenants.kiosk_pay_qr_enabled: interruptor por negocio, APAGADO por defecto.
--  * kiosk_payments: cada intento de pago por QR (monto calculado en el servidor, estado y datos de Mercado Pago).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kiosk_pay_qr_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS kiosk_payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  amount         integer NOT NULL CHECK (amount > 0),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired')),
  mp_preference_id text,
  mp_payment_id  text,
  paid_amount    integer,
  created_at     timestamptz NOT NULL DEFAULT now(),
  paid_at        timestamptz,
  recorded_at    timestamptz,            -- cuando el equipo lo registro en el POS (reservado para una etapa futura)
  UNIQUE (mp_payment_id)
);
CREATE INDEX IF NOT EXISTS kiosk_payments_cita_idx ON kiosk_payments (appointment_id, status);
CREATE INDEX IF NOT EXISTS kiosk_payments_negocio_idx ON kiosk_payments (tenant_id, created_at DESC);
ALTER TABLE kiosk_payments ENABLE ROW LEVEL SECURITY;  -- sin politicas: solo el servidor (llave de servicio) accede

-- Verificacion: columna = 1, tabla = 1.
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name='tenants' AND column_name='kiosk_pay_qr_enabled') AS columna_1,
  (SELECT count(*) FROM information_schema.tables WHERE table_name='kiosk_payments') AS tabla_1;
