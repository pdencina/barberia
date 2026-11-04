-- 133 · Datos de la reserva mientras se paga el abono. Aditiva y re-ejecutable.
-- Mercado Pago solo acepta 256 caracteres en la referencia del pago y los datos de una reserva ocupan mas de 400:
-- los datos se guardan aqui y a Mercado Pago solo se le manda la referencia corta (el id de esta fila).
CREATE TABLE IF NOT EXISTS booking_intents (
  ref uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_intents_created ON booking_intents(created_at);
ALTER TABLE booking_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_intents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON booking_intents TO service_role;

-- Verificacion (debe devolver 1 fila):
-- SELECT table_name FROM information_schema.tables WHERE table_name='booking_intents';
