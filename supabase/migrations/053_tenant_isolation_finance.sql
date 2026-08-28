-- Add tenant_id to the tables that were missed by 045_tenant_isolation.sql / 046 / 050 / 052.
-- Without this column, these tables mix data across every business on the platform:
-- cash register, commissions, rental (arriendo), loyalty program, inventory movements
-- and booking metrics. This is the same class of bug fixed for clients/products/invoices.

ALTER TABLE cash_register ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE rental_records ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE loyalty_config ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE loyalty_points ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS idx_cash_register_tenant ON cash_register(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commissions_tenant ON commissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rental_records_tenant ON rental_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_config_tenant ON loyalty_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_tenant ON loyalty_rewards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_tenant ON loyalty_points(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant ON inventory_movements(tenant_id);

-- cash_register.date had a UNIQUE constraint on its own, so only ONE business in the
-- whole platform could open a register per calendar day (every other business got
-- "la caja de hoy ya fue abierta" even though they hadn't opened one). Make it unique
-- per business instead.
ALTER TABLE cash_register DROP CONSTRAINT IF EXISTS cash_register_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_register_tenant_date ON cash_register(tenant_id, date);

-- booking_metrics: table exists in the live database but has no tracked migration.
-- Create it defensively (IF NOT EXISTS) with tenant_id from the start so it's covered
-- going forward, without touching it if it already has a different shape.
CREATE TABLE IF NOT EXISTS booking_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  barber_id UUID REFERENCES profiles(id),
  client_id UUID REFERENCES clients(id),
  tenant_id UUID REFERENCES tenants(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE booking_metrics ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_booking_metrics_tenant ON booking_metrics(tenant_id);
ALTER TABLE booking_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "booking_metrics_all" ON booking_metrics;
CREATE POLICY "booking_metrics_all" ON booking_metrics FOR ALL TO authenticated USING (true);

-- IMPORTANT: existing rows in all these tables will have tenant_id = NULL and will be
-- invisible everywhere until assigned. Example (replace with the correct business id):
--   UPDATE cash_register     SET tenant_id = '<tenant-uuid>' WHERE tenant_id IS NULL;
--   UPDATE commissions       SET tenant_id = '<tenant-uuid>' WHERE tenant_id IS NULL;
--   UPDATE rental_records    SET tenant_id = '<tenant-uuid>' WHERE tenant_id IS NULL;
--   UPDATE loyalty_config    SET tenant_id = '<tenant-uuid>' WHERE tenant_id IS NULL;
--   UPDATE loyalty_rewards   SET tenant_id = '<tenant-uuid>' WHERE tenant_id IS NULL;
--   UPDATE loyalty_points    SET tenant_id = '<tenant-uuid>' WHERE tenant_id IS NULL;
--   UPDATE inventory_movements SET tenant_id = '<tenant-uuid>' WHERE tenant_id IS NULL;
