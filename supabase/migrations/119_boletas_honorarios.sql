-- 119: Registro de las boletas de honorarios que emiten los profesionales (figura con retencion, ej. 15,25 %).
-- re-booking NO las emite (las emite el profesional en el SII): aqui el administrador registra la boleta recibida
-- (folio, fecha, monto) para compararla con lo esperado y sumar la retencion del mes.
--
-- ADITIVA y RE-EJECUTABLE. Sin datos al crearla. El codigo tolera que falte. Probar primero en `rebooking-pruebas`.

CREATE TABLE IF NOT EXISTS honorarios_boletas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL,                       -- primer dia del mes que corresponde
  expected_gross INTEGER NOT NULL DEFAULT 0, -- lo esperado al registrar (comision del mes)
  retention_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  expected_retention INTEGER NOT NULL DEFAULT 0,
  folio TEXT,
  issued_on DATE,
  amount INTEGER,                            -- monto bruto de la boleta recibida
  retention_amount INTEGER,                  -- retencion segun lo recibido (amount x tasa)
  notes TEXT,
  registered_by UUID,
  registered_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, month)
);
CREATE INDEX IF NOT EXISTS idx_honorarios_tenant_month ON honorarios_boletas(tenant_id, month);
ALTER TABLE honorarios_boletas ENABLE ROW LEVEL SECURITY;
-- Sin policies de usuario final: solo el servidor (clave de servicio).

-- Verificacion (0 filas):
--   SELECT count(*) FROM honorarios_boletas;
