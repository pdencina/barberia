-- 116: Boleta electronica (SII) con la cuenta de cada negocio.
-- Cada negocio contrata su propio proveedor (OpenFactura/Haulmer) y carga aqui sus datos de emisor y su llave.
-- Hasta ahora el proveedor era uno solo para toda la plataforma (variables de entorno).
--
-- ADITIVA y RE-EJECUTABLE. APAGADA por defecto (enabled = false, auto_emit = false).
-- El codigo tolera que falte esta migracion (avisa "Falta aplicar la migracion 116").
-- Probar primero en `rebooking-pruebas`.

CREATE TABLE IF NOT EXISTS tenant_billing_sii (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  auto_emit BOOLEAN NOT NULL DEFAULT false,      -- emitir sola al cobrar (si no, boton manual)
  provider TEXT NOT NULL DEFAULT 'haulmer' CHECK (provider IN ('haulmer')),
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  emisor_rut TEXT,
  emisor_razon_social TEXT,
  emisor_giro TEXT,
  emisor_direccion TEXT,
  emisor_comuna TEXT,
  api_key_enc TEXT,                              -- llave del proveedor CIFRADA (AES-256-GCM); nunca en claro
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenant_billing_sii ENABLE ROW LEVEL SECURITY;
-- Sin policies de usuario final: solo se lee y escribe con el cliente admin desde el servidor.

-- Ambiente y tipo de documento de cada boleta emitida (para separar pruebas de reales).
ALTER TABLE boletas_emitidas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE boletas_emitidas ADD COLUMN IF NOT EXISTS environment TEXT;

-- Verificacion (debe devolver la tabla con 0 filas y las 2 columnas nuevas):
--   SELECT count(*) FROM tenant_billing_sii;
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'boletas_emitidas' AND column_name IN ('tenant_id','environment');
