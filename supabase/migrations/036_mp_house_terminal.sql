-- Store house terminal config in DB (not just env vars)
CREATE TABLE IF NOT EXISTS mp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Terminal de la Casa',
  access_token TEXT,
  device_id TEXT,
  is_default BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_config_all" ON mp_config FOR ALL TO authenticated USING (true);

-- Insert default (from env vars initially)
INSERT INTO mp_config (name, is_default) VALUES ('Terminal de la Casa', true)
ON CONFLICT DO NOTHING;
