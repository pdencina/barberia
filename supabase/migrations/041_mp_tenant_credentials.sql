-- MercadoPago credentials per tenant (self-service)
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS mp_access_token TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS mp_device_id TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS mp_device_name TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS mp_configured BOOLEAN NOT NULL DEFAULT false;
