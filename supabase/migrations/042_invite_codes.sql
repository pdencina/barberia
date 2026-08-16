-- Invite codes for professionals to join a tenant
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  uses_remaining INT NOT NULL DEFAULT 10,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_tenant ON invite_codes(tenant_id);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invite_codes_all" ON invite_codes FOR ALL TO authenticated USING (true);
