-- ==================== MULTI-TENANT SaaS ====================
-- Each business that contracts re-booking is a "tenant"

-- Tenants (empresas)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL: rebooking.cl/app/{slug}
  rut_empresa TEXT,
  plan TEXT NOT NULL DEFAULT 'starter', -- starter, pro, enterprise
  max_professionals INT NOT NULL DEFAULT 3,
  max_branches INT NOT NULL DEFAULT 1,
  admin_email TEXT NOT NULL,
  admin_name TEXT,
  temp_password TEXT, -- temporal, se limpia al cambiar
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  trial_ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'trial', -- trial, active, suspended, cancelled
  logo_url TEXT,
  phone TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Santiago',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- Tenant settings
CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  booking_enabled BOOLEAN NOT NULL DEFAULT true,
  reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  reviews_enabled BOOLEAN NOT NULL DEFAULT true,
  loyalty_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  custom_branding BOOLEAN NOT NULL DEFAULT false,
  primary_color TEXT DEFAULT '#1E88E5',
  notification_email TEXT,
  cancellation_min_hours INT NOT NULL DEFAULT 2,
  points_per_clp INT NOT NULL DEFAULT 1000
);

-- Subscriptions (billing)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'trial', -- trial, active, past_due, cancelled
  amount INT, -- monthly amount in CLP
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);

-- Plan limits reference
CREATE TABLE IF NOT EXISTS plan_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  max_professionals INT NOT NULL,
  max_branches INT NOT NULL,
  max_clients INT,
  price_clp INT NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'
);

INSERT INTO plan_limits (plan, name, max_professionals, max_branches, max_clients, price_clp, features) VALUES
  ('starter', 'Starter', 3, 1, 500, 49990, '["booking", "pos", "calendar", "reminders", "pwa"]'),
  ('pro', 'Pro', 10, 2, 5000, 89990, '["booking", "pos", "calendar", "reminders", "pwa", "commissions", "rental", "mercadopago", "reports", "loyalty", "coupons", "photos", "whatsapp"]'),
  ('enterprise', 'Enterprise', 999, 10, 99999, 0, '["booking", "pos", "calendar", "reminders", "pwa", "commissions", "rental", "mercadopago", "reports", "loyalty", "coupons", "photos", "whatsapp", "api", "multi_branch", "custom_branding", "dedicated_support"]')
ON CONFLICT (plan) DO NOTHING;

-- Link profiles to tenants
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);

-- Link branches to tenants
ALTER TABLE branches ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- RLS policies
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_all" ON tenants FOR ALL TO authenticated USING (true);
CREATE POLICY "tenant_settings_all" ON tenant_settings FOR ALL TO authenticated USING (true);
CREATE POLICY "subscriptions_all" ON subscriptions FOR ALL TO authenticated USING (true);
CREATE POLICY "plan_limits_read" ON plan_limits FOR SELECT TO authenticated USING (true);
