-- 125 · Anotar gastos personales por voz con un Atajo de iPhone. Aditiva y re-ejecutable.
-- Cada persona puede tener una llave personal (solo sirve para anotar sus gastos personales). Se guarda SOLO la huella (HMAC); la llave se muestra una vez.
CREATE TABLE IF NOT EXISTS personal_voice_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS personal_voice_keys_user_idx ON personal_voice_keys (user_id) WHERE revoked_at IS NULL;
ALTER TABLE personal_voice_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON personal_voice_keys FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON personal_voice_keys TO service_role;
-- Los movimientos anotados por voz llevan source = 'voz'.
ALTER TABLE personal_entries DROP CONSTRAINT IF EXISTS personal_entries_source_check;
ALTER TABLE personal_entries ADD CONSTRAINT personal_entries_source_check CHECK (source IN ('manual', 'oti', 'voz'));

-- Verificación (debe devolver 1 fila):
-- SELECT table_name FROM information_schema.tables WHERE table_name='personal_voice_keys';
