-- TUU (Haulmer) "Pago Remoto" terminal integration — parallel to MercadoPago Point,
-- selectable per tenant. Defaults keep every existing tenant on MercadoPago exactly as
-- before; only a tenant that explicitly configures TUU switches its POS card charges
-- over to it.

-- Which provider handles card charges from the POS for this tenant.
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS card_payment_provider TEXT NOT NULL DEFAULT 'mercadopago';

-- TUU credentials: a single API Key per comercio (Espacio de Trabajo), unlike
-- MercadoPago which needs a token per MP account. One key can drive multiple devices.
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS tuu_api_key TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS tuu_configured BOOLEAN NOT NULL DEFAULT false;

-- Multiple TUU terminals (physical devices) per tenant, identified by serial number
-- (printed on the POS under "SN:"). Mirrors mp_terminals' services/products/all
-- routing so a business can keep a dedicated machine per cart type.
CREATE TABLE IF NOT EXISTS tuu_terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_serial TEXT NOT NULL,
  terminal_type TEXT NOT NULL DEFAULT 'all', -- 'services', 'products', 'all'
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tuu_terminals_tenant ON tuu_terminals(tenant_id);
ALTER TABLE tuu_terminals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tuu_terminals_all" ON tuu_terminals FOR ALL TO authenticated USING (true);

-- Payment requests sent to TUU, tracked by idempotencyKey (TUU's own tracking id,
-- analogous to mp_payment_intents.mp_payment_id for MercadoPago).
CREATE TABLE IF NOT EXISTS tuu_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  barber_id UUID REFERENCES profiles(id),
  tenant_id UUID REFERENCES tenants(id),
  amount NUMERIC(10,0) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, processing, completed, failed, cancelled
  idempotency_key TEXT NOT NULL,
  device_serial TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tuu_payment_intents_key ON tuu_payment_intents(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_tuu_payment_intents_status ON tuu_payment_intents(status);
ALTER TABLE tuu_payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tuu_payment_intents_all" ON tuu_payment_intents FOR ALL TO authenticated USING (true);
