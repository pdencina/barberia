-- 137 · Mi Billetera: sueldo del mes anotado a mano y % de ahorro de cada persona. Aditiva y re-ejecutable.
-- Privado como personal_entries: cada fila es de un usuario y SOLO ese usuario la ve (la API filtra por la sesión).
CREATE TABLE IF NOT EXISTS personal_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,                                        -- profiles.id (sin FK a propósito, igual que personal_entries)
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  month date NOT NULL,                                          -- primer día del mes
  salary integer NOT NULL DEFAULT 0 CHECK (salary >= 0 AND salary <= 1000000000),
  savings_pct numeric(5,2) NOT NULL DEFAULT 10 CHECK (savings_pct >= 0 AND savings_pct <= 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);
ALTER TABLE personal_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON personal_budget FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON personal_budget TO service_role;

-- Verificación (debe devolver 1 fila):
-- SELECT table_name FROM information_schema.tables WHERE table_name='personal_budget';
