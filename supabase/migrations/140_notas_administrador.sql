-- 140 · Notas del administrador en el Dashboard (las deja Oti o se escriben a mano). Aditiva y re-ejecutable.
-- Cada nota es de UN administrador (user_id); la API filtra siempre por la sesión. Se quedan visibles hasta que se borran (con confirmación).
CREATE TABLE IF NOT EXISTS admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,                                        -- profiles.id del administrador (sin FK a propósito, igual que personal_entries)
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 200),
  day_of_month integer CHECK (day_of_month BETWEEN 1 AND 31),   -- día del mes en que hay que acordarse (opcional)
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'oti')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_notes_user_idx ON admin_notes (user_id, created_at DESC);
ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_notes TO service_role;

-- Verificación (debe devolver 1 fila):
-- SELECT table_name FROM information_schema.tables WHERE table_name='admin_notes';
