-- 124 · Mi Billetera: movimientos PERSONALES (gastos e ingresos) de cada persona, anotados a mano o con Oti.
-- Aditiva y re-ejecutable. Son privados: cada fila pertenece a un usuario (user_id) y SOLO ese usuario la ve (la API filtra por la sesión).
-- No se mezclan con los gastos del negocio (transactions): son otra tabla.
CREATE TABLE IF NOT EXISTS personal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,                                     -- profiles.id de quien lo anotó (sin FK a propósito: igual que created_by en transactions)
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('expense', 'income')),
  amount integer NOT NULL CHECK (amount > 0 AND amount <= 100000000),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 200),
  category text NOT NULL DEFAULT 'Otros' CHECK (char_length(category) BETWEEN 1 AND 40),
  entry_date date NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'oti')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS personal_entries_user_date_idx ON personal_entries (user_id, entry_date DESC);
ALTER TABLE personal_entries ENABLE ROW LEVEL SECURITY;
-- Sin políticas: el navegador no accede; solo el servidor (service_role), que siempre filtra por el usuario de la sesión.
REVOKE ALL ON personal_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON personal_entries TO service_role;

-- Verificación (debe devolver 1 fila):
-- SELECT table_name FROM information_schema.tables WHERE table_name='personal_entries';
