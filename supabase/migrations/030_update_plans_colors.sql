-- Update plans to new 4-tier pricing
DELETE FROM plan_limits;
INSERT INTO plan_limits (plan, name, max_professionals, max_branches, max_clients, price_clp, features) VALUES
  ('basic', 'Basic', 1, 1, 100, 8900, '["booking", "calendar", "whatsapp_100", "email_100", "reports_basic", "ai_weekly"]'),
  ('starter', 'Starter', 3, 1, 500, 29990, '["booking", "calendar", "pos", "whatsapp_400", "email_500", "reports_advanced", "ai_weekly", "whatsapp_bulk", "client_files", "coupons", "cash_register", "loyalty"]'),
  ('pro', 'Pro', 8, 1, 5000, 49990, '["booking", "calendar", "pos", "whatsapp_1000", "email_2000", "reports_advanced", "ai_weekly", "whatsapp_bulk", "client_files", "coupons", "cash_register", "loyalty", "custom_colors", "commissions", "rental", "invoices", "inventory", "mercadopago"]'),
  ('enterprise', 'Enterprise', 999, 10, 99999, 189990, '["booking", "calendar", "pos", "whatsapp_unlimited", "email_unlimited", "reports_advanced", "ai_weekly", "whatsapp_bulk", "client_files", "coupons", "cash_register", "loyalty", "custom_colors", "commissions", "rental", "invoices", "inventory", "mercadopago", "multi_branch", "api", "integrations", "dedicated_support", "onboarding", "sla", "account_manager", "custom_modules", "custom_reports", "backups", "training"]')
ON CONFLICT (plan) DO UPDATE SET
  name = EXCLUDED.name,
  max_professionals = EXCLUDED.max_professionals,
  max_branches = EXCLUDED.max_branches,
  max_clients = EXCLUDED.max_clients,
  price_clp = EXCLUDED.price_clp,
  features = EXCLUDED.features;

-- Add 'basic' to enum if needed (tenants.plan)
-- No enum constraint on plan column (it's TEXT), so this just works.
