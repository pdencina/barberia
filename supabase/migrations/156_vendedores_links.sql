-- 156: vendedores de re-booking con link propio (re-booking.cl/precios?v=<slug>) y enlace privado de metricas.
-- Aditiva y re-ejecutable. Solo la lee el servidor (RLS activado y sin politicas).
CREATE TABLE IF NOT EXISTS sellers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  token      TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sellers_slug_key ON sellers (slug);
CREATE UNIQUE INDEX IF NOT EXISTS sellers_token_key ON sellers (token);
ALTER TABLE sellers DROP CONSTRAINT IF EXISTS sellers_slug_format;
ALTER TABLE sellers ADD CONSTRAINT sellers_slug_format CHECK (slug ~ '^[a-z0-9-]{2,40}$');
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

-- Verificacion: debe devolver 1 fila.
SELECT table_name FROM information_schema.tables WHERE table_name = 'sellers';
