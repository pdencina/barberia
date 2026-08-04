-- Login sessions tracking
CREATE TABLE IF NOT EXISTS login_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  user_email TEXT,
  user_role TEXT,
  device TEXT, -- 'mobile', 'desktop', 'tablet'
  browser TEXT,
  ip_address TEXT,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  logged_out_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_login_sessions_user ON login_sessions(user_id);
CREATE INDEX idx_login_sessions_date ON login_sessions(logged_in_at DESC);

ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "login_sessions_all" ON login_sessions FOR ALL TO authenticated USING (true);
