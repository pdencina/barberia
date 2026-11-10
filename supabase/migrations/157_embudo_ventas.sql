-- 157: embudo de ventas de las visitas que llegan por un link de vendedor o creador (re-booking.cl/precios?v=...).
-- Guarda pasos anonimos: id de visita al azar, paso, dispositivo, sistema, navegador y ciudad aproximada. SIN IP, correo, telefono ni nombres.
-- Aditiva y re-ejecutable. Solo la lee y escribe el servidor (RLS activado y sin politicas).
CREATE TABLE IF NOT EXISTS funnel_events (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  visit_id   TEXT NOT NULL,
  step       TEXT NOT NULL,
  source     TEXT,
  campaign   TEXT,
  plan       TEXT,
  device     TEXT,
  os         TEXT,
  browser    TEXT,
  city       TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS funnel_events_visit_step_key ON funnel_events (visit_id, step);
CREATE INDEX IF NOT EXISTS funnel_events_campaign_idx ON funnel_events (source, campaign, created_at);
ALTER TABLE funnel_events DROP CONSTRAINT IF EXISTS funnel_events_step_check;
ALTER TABLE funnel_events ADD CONSTRAINT funnel_events_step_check CHECK (step IN ('landing_view','precios_view','plan_click','checkout_open','form_started','pay_click','pay_error'));
ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;

-- Verificacion: debe devolver 1 fila.
SELECT table_name FROM information_schema.tables WHERE table_name = 'funnel_events';
