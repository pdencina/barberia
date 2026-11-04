-- 117: Impuesto/boleta SII por profesional.
-- Cada profesional (comision o arriendo) puede tener encendida la integracion con el SII y una tasa:
--   0 (apagado), 15.25 (boleta de honorarios, retencion) o 19 (IVA).
-- Solo es INFORMATIVO en la liquidacion: no cambia el total a pagar ni la caja.
--
-- ADITIVA y RE-EJECUTABLE. APAGADA por defecto. El codigo tolera que falte esta migracion.
-- Probar primero en `rebooking-pruebas`.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sii_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tax_rate_range;
ALTER TABLE profiles ADD CONSTRAINT profiles_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 100);

-- Un profesional no puede cambiarse a si mismo la tasa (se suman a las columnas protegidas de la 088).
CREATE OR REPLACE FUNCTION protect_profile_sensitive_columns()
RETURNS TRIGGER AS $$
DECLARE
  col TEXT;
  protected TEXT[] := ARRAY[
    'role', 'tenant_id', 'active', 'personal_pin', 'mp_access_token',
    'work_mode', 'commission_rate', 'rental_daily_rate', 'booking_slug',
    'sii_enabled', 'tax_rate'
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

-- Verificacion (2 columnas; y todos los profesionales apagados = 0 filas encendidas):
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('sii_enabled','tax_rate');
--   SELECT count(*) FROM profiles WHERE sii_enabled;
