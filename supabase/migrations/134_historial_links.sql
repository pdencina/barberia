-- 134 · Historial de links de negocio: si un negocio cambia su link (ej. de saray-ovalle-i7e7 a looky-estudio), el link viejo sigue funcionando y lleva al nuevo.
-- Aditiva y re-ejecutable.
CREATE TABLE IF NOT EXISTS tenant_slug_history (
  old_slug text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenant_slug_history_tenant ON tenant_slug_history(tenant_id);
ALTER TABLE tenant_slug_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tenant_slug_history FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_slug_history TO service_role;

-- Verificacion (debe devolver 1 fila):
-- SELECT table_name FROM information_schema.tables WHERE table_name='tenant_slug_history';
