-- Multiple MercadoPago terminals per tenant
CREATE TABLE IF NOT EXISTS mp_terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- "Maquina Servicios", "Maquina Productos"
  device_id TEXT NOT NULL,               -- NEWLAND_N950__XXXXX
  terminal_type TEXT NOT NULL DEFAULT 'all', -- 'services', 'products', 'all'
  access_token TEXT,                     -- If null, uses tenant_settings.mp_access_token
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_terminals_tenant ON mp_terminals(tenant_id);
ALTER TABLE mp_terminals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_terminals_all" ON mp_terminals FOR ALL TO authenticated USING (true);
