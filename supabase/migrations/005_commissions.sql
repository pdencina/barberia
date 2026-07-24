-- Agregar tasa de comision a profiles de barberos
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 40;
-- Default 40% para barberos

-- Tabla de comisiones calculadas (para historial)
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES profiles(id),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  sale_total NUMERIC(10,0) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(10,0) NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_commissions_barber ON commissions(barber_id);
CREATE INDEX idx_commissions_paid ON commissions(barber_id, paid);

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commissions_all" ON commissions FOR ALL TO authenticated USING (true);
