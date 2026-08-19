-- Add tenant_id to core tables for multi-tenant isolation
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE services ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);

-- Backfill: assign existing data to the first tenant (Estudio Levels)
-- Run this manually after migration if you have existing data:
-- UPDATE clients SET tenant_id = 'YOUR_TENANT_ID' WHERE tenant_id IS NULL;
-- UPDATE services SET tenant_id = 'YOUR_TENANT_ID' WHERE tenant_id IS NULL;
-- UPDATE appointments SET tenant_id = 'YOUR_TENANT_ID' WHERE tenant_id IS NULL;
-- UPDATE transactions SET tenant_id = 'YOUR_TENANT_ID' WHERE tenant_id IS NULL;
-- UPDATE products SET tenant_id = 'YOUR_TENANT_ID' WHERE tenant_id IS NULL;
