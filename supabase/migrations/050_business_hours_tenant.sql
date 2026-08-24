-- Add tenant_id to business_hours for multi-tenant support
ALTER TABLE business_hours ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
-- Remove the unique constraint on day_of_week (now unique per tenant)
ALTER TABLE business_hours DROP CONSTRAINT IF EXISTS business_hours_day_of_week_key;
-- Add new unique constraint per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_hours_tenant_day ON business_hours(tenant_id, day_of_week);
