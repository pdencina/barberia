-- 131 · Cobro de abonos al reservar con la cuenta de Mercado Pago DEL NEGOCIO (no la de re-booking). Aditiva y re-ejecutable.
--   mp_online_access_token  token de produccion de Mercado Pago del negocio para cobros online, GUARDADO CIFRADO (nunca se devuelve al navegador).
--   mp_online_account       nombre/correo de la cuenta conectada (solo para mostrar).
--   deposit_mode            'percent' = porcentaje del servicio | 'fixed' = monto fijo (deposit_fixed_amount).
--   booking_deposits        registro de cada abono recibido (evita crear dos citas si Mercado Pago avisa dos veces, y deja el historial).
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS mp_online_access_token text;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS mp_online_account text;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS mp_online_connected_at timestamptz;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS deposit_mode text NOT NULL DEFAULT 'percent';
ALTER TABLE tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_deposit_mode_check;
ALTER TABLE tenant_settings ADD CONSTRAINT tenant_settings_deposit_mode_check CHECK (deposit_mode IN ('percent', 'fixed'));
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS deposit_fixed_amount integer;

CREATE TABLE IF NOT EXISTS booking_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id text NOT NULL UNIQUE,                 -- id del pago en Mercado Pago
  appointment_id uuid,
  amount integer NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'approved',         -- approved | refunded
  payer_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_deposits_tenant ON booking_deposits(tenant_id, created_at DESC);
ALTER TABLE booking_deposits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_deposits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON booking_deposits TO service_role;
-- El token va cifrado y la app NUNCA lo devuelve al navegador; solo lo lee el servidor (service_role).

-- Verificacion (debe devolver 5 filas):
-- SELECT column_name FROM information_schema.columns WHERE table_name='tenant_settings' AND column_name IN ('mp_online_access_token','mp_online_account','mp_online_connected_at','deposit_mode','deposit_fixed_amount');
