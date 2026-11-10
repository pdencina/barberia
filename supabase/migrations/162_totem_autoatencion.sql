-- 162: Totem de autoatencion (aditiva y re-ejecutable).
--  * appointments.checkin_code: codigo corto (5 letras/numeros sin O/0/I/1) que se envia en el correo; unico por negocio y dia.
--  * appointments.arrived_at: cuando el cliente aviso que llego (desde el totem).
--  * tenants.kiosk_enabled (apagado por defecto) y tenants.kiosk_info (textos de cursos/promociones/planes).
--  * un disparador asigna el codigo a toda cita nueva, venga de donde venga.

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checkin_code text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS arrived_at timestamptz;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kiosk_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kiosk_info jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_checkin_code_dia_uq
  ON appointments (tenant_id, date, checkin_code) WHERE checkin_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generar_checkin_code(p_tenant uuid, p_date date)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  codigo text;
  intento int := 0;
BEGIN
  LOOP
    codigo := '';
    FOR i IN 1..5 LOOP
      codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM appointments WHERE tenant_id IS NOT DISTINCT FROM p_tenant AND date IS NOT DISTINCT FROM p_date AND checkin_code = codigo) THEN
      RETURN codigo;
    END IF;
    intento := intento + 1;
    IF intento > 50 THEN RETURN NULL; END IF; -- nunca bloquea la creacion de una cita
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.trg_appointments_checkin_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.checkin_code IS NULL THEN
    NEW.checkin_code := public.generar_checkin_code(NEW.tenant_id, NEW.date);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS appointments_checkin_code ON appointments;
CREATE TRIGGER appointments_checkin_code BEFORE INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_appointments_checkin_code();

-- Citas de hoy en adelante que aun no tienen codigo (las pasadas no lo necesitan).
UPDATE appointments SET checkin_code = public.generar_checkin_code(tenant_id, date)
 WHERE checkin_code IS NULL AND date >= (now() AT TIME ZONE 'America/Santiago')::date AND status IN ('scheduled','confirmed');

-- Verificacion: debe mostrar columnas, disparador y citas futuras sin codigo = 0.
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name='appointments' AND column_name IN ('checkin_code','arrived_at')) AS columnas_citas_2,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='tenants' AND column_name IN ('kiosk_enabled','kiosk_info')) AS columnas_negocio_2,
  (SELECT count(*) FROM pg_trigger WHERE tgname='appointments_checkin_code') AS disparador_1,
  (SELECT count(*) FROM appointments WHERE checkin_code IS NULL AND status IN ('scheduled','confirmed') AND date >= (now() AT TIME ZONE 'America/Santiago')::date) AS futuras_sin_codigo_0;
