-- 121 · Referidos etapas 2 y 3: descuento del referido y mes gratis de quien invita.
-- Aditiva y re-ejecutable. El código tolera que falte (no aplica beneficios y avisa).
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS discount_pct integer;            -- ej. 50 (solo planes mensuales)
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS discount_months integer;         -- ej. 2
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS full_amount integer;             -- precio normal por ciclo (CLP, con IVA)
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS discount_charges integer NOT NULL DEFAULT 0;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS discount_ended_at timestamptz;   -- cuando se volvió al precio normal

-- Un crédito de mes gratis por cada referido que pagó (unique evita duplicados). Se aplica reembolsando el siguiente cobro mensual.
CREATE TABLE IF NOT EXISTS referral_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,        -- quien invitó
  referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'disponible' CHECK (status IN ('disponible', 'aplicado')),
  applied_payment_id text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_credits_one_per_referral UNIQUE (referral_id)
);
CREATE INDEX IF NOT EXISTS referral_credits_tenant_idx ON referral_credits (tenant_id, status);
ALTER TABLE referral_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON referral_credits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON referral_credits TO service_role;

-- Verificación (debe devolver 6 filas):
-- SELECT table_name, column_name FROM information_schema.columns WHERE (table_name='referrals' AND column_name IN ('discount_pct','discount_months','full_amount','discount_charges','discount_ended_at')) OR (table_name='referral_credits' AND column_name='status') ORDER BY 1,2;
