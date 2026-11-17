-- Solicitudes de vacaciones (Mi negocio > Vacaciones). Aditiva y re-ejecutable.
-- El administrador define cuantos dias laborales al año puede pedir cada profesional (vacation_days_per_year; vacio = no se pueden pedir),
-- cuando se reinicia el derecho (1 de enero o aniversario del ingreso) y la fecha de ingreso de cada profesional.
-- Cada solicitud aprobada crea una fila en professional_vacations (migracion 095), asi la agenda y la reserva online la respetan sin cambios.

ALTER TABLE tenants  ADD COLUMN IF NOT EXISTS vacation_days_per_year SMALLINT;
ALTER TABLE tenants  ADD COLUMN IF NOT EXISTS vacation_reset_mode TEXT NOT NULL DEFAULT 'calendar';
ALTER TABLE tenants  DROP CONSTRAINT IF EXISTS tenants_vacation_reset_mode_check;
ALTER TABLE tenants  ADD CONSTRAINT tenants_vacation_reset_mode_check CHECK (vacation_reset_mode IN ('calendar', 'anniversary'));
ALTER TABLE tenants  DROP CONSTRAINT IF EXISTS tenants_vacation_days_per_year_check;
ALTER TABLE tenants  ADD CONSTRAINT tenants_vacation_days_per_year_check CHECK (vacation_days_per_year IS NULL OR (vacation_days_per_year BETWEEN 1 AND 30));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vacation_start_date DATE;   -- fecha de ingreso (si falta, se usa la fecha en que se creo el perfil)

CREATE TABLE IF NOT EXISTS vacation_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  barber_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  working_days    SMALLINT NOT NULL,                       -- dias laborales del profesional dentro del rango
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  decided_by      UUID,
  decided_by_name TEXT,
  decided_at      TIMESTAMPTZ,
  decision_note   TEXT,
  vacation_id     UUID,                                    -- fila creada en professional_vacations al aprobar
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vacation_requests_dates_check CHECK (end_date >= start_date),
  CONSTRAINT vacation_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_vacreq_tenant ON vacation_requests(tenant_id, status, start_date);
CREATE INDEX IF NOT EXISTS idx_vacreq_barber ON vacation_requests(barber_id, start_date, end_date);
ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;   -- sin politicas: solo la API (llave de servicio)

-- Verificacion: debe devolver las 3 columnas y la tabla.
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name = 'tenants' AND column_name IN ('vacation_days_per_year', 'vacation_reset_mode')) AS columnas_negocio,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'vacation_start_date') AS columna_ingreso,
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'vacation_requests') AS tabla_solicitudes;
