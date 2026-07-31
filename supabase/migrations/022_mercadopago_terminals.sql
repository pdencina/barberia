-- MercadoPago multi-terminal: cada barbero en arriendo tiene su propio terminal
-- Los de comisión comparten el terminal de la casa

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mp_access_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mp_device_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mp_external_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mp_store_id TEXT;

-- Tabla para almacenar intentos de pago con MP
CREATE TABLE IF NOT EXISTS mp_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  barber_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(10,0) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, cancelled
  mp_payment_id TEXT,
  mp_external_reference TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mp_payment_intents_barber ON mp_payment_intents(barber_id);
CREATE INDEX idx_mp_payment_intents_status ON mp_payment_intents(status);

ALTER TABLE mp_payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_payment_intents_all" ON mp_payment_intents FOR ALL TO authenticated USING (true);
