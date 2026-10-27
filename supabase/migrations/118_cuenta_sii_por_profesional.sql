-- 118: Cuenta SII propia de un profesional (cuando el profesional paga su propio impuesto).
-- La configura SOLO el administrador del negocio (el profesional no puede verla ni cambiarla).
--   tax_bearer = 'business'     -> la boleta de sus ventas sale con la cuenta del negocio (el negocio asume el IVA).
--   tax_bearer = 'professional' -> sale con la cuenta de este profesional (tabla de abajo).
--
-- ADITIVA y RE-EJECUTABLE. APAGADA por defecto. Requiere la 116 y la 117. Probar primero en `rebooking-pruebas`.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tax_bearer TEXT NOT NULL DEFAULT 'business';
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tax_bearer_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_tax_bearer_check CHECK (tax_bearer IN ('business', 'professional'));

CREATE TABLE IF NOT EXISTS professional_billing_sii (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  auto_emit BOOLEAN NOT NULL DEFAULT false,
  provider TEXT NOT NULL DEFAULT 'haulmer' CHECK (provider IN ('haulmer')),
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  emisor_rut TEXT,
  emisor_razon_social TEXT,
  emisor_giro TEXT,
  emisor_direccion TEXT,
  emisor_comuna TEXT,
  api_key_enc TEXT,                  -- CIFRADA (AES-256-GCM); nunca en claro
  updated_by UUID,                   -- administrador que hizo el ultimo cambio
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_professional_billing_sii_tenant ON professional_billing_sii(tenant_id);
ALTER TABLE professional_billing_sii ENABLE ROW LEVEL SECURITY;
-- Sin policies de usuario final: solo el servidor (clave de servicio) la lee y escribe.

-- Que boleta salio con que cuenta (para revisar despues).
DO $$
BEGIN
  IF to_regclass('public.boletas_emitidas') IS NOT NULL THEN
    ALTER TABLE boletas_emitidas ADD COLUMN IF NOT EXISTS issuer_profile_id UUID;
  END IF;
END $$;

-- El profesional no puede cambiarse a si mismo quien paga el impuesto.
CREATE OR REPLACE FUNCTION protect_profile_sensitive_columns()
RETURNS TRIGGER AS $$
DECLARE
  col TEXT;
  protected TEXT[] := ARRAY[
    'role', 'tenant_id', 'active', 'personal_pin', 'mp_access_token',
    'work_mode', 'commission_rate', 'rental_daily_rate', 'booking_slug',
    'sii_enabled', 'tax_rate', 'tax_bearer'
  ];
BEGIN
  IF auth.uid() IS NULL OR COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  FOREACH col IN ARRAY protected LOOP
    IF (to_jsonb(NEW) -> col) IS DISTINCT FROM (to_jsonb(OLD) -> col) THEN
      RAISE EXCEPTION 'No tienes permiso para modificar la columna % del perfil', col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificacion (tax_bearer existe; la tabla existe con 0 filas):
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'tax_bearer';
--   SELECT count(*) FROM professional_billing_sii;
