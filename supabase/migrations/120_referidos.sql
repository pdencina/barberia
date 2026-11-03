-- 120 · Referidos (etapa 1: solo registro, no cambia ningún cobro).
-- Aditiva y re-ejecutable. El código tolera que falte (reintenta sin las columnas nuevas).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS referral_code text;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_referral_code_key ON tenants (referral_code) WHERE referral_code IS NOT NULL;
ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS referral_code text;

CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  referred_signup_id uuid NOT NULL REFERENCES signup_requests(id) ON DELETE CASCADE,
  referred_tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CONSTRAINT referrals_one_per_signup UNIQUE (referred_signup_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_tenant_id, created_at DESC);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo el servidor (service_role) lee y escribe.
REVOKE ALL ON referrals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON referrals TO service_role;

-- Verificación (debe devolver 3 filas):
-- SELECT table_name, column_name FROM information_schema.columns WHERE (table_name='tenants' AND column_name='referral_code') OR (table_name='signup_requests' AND column_name='referral_code') OR (table_name='referrals' AND column_name='status');
