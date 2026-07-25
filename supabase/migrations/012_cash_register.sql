-- Caja diaria (apertura/cierre)
CREATE TABLE IF NOT EXISTS cash_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  opened_by UUID REFERENCES profiles(id),
  closed_by UUID REFERENCES profiles(id),
  opening_amount NUMERIC(10,0) NOT NULL DEFAULT 0, -- monto inicial en caja
  closing_amount NUMERIC(10,0), -- monto contado al cerrar
  expected_amount NUMERIC(10,0), -- monto esperado (apertura + ingresos efectivo - egresos efectivo)
  difference NUMERIC(10,0), -- diferencia (contado - esperado)
  status TEXT NOT NULL DEFAULT 'open', -- open, closed
  notes TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_register_date ON cash_register(date);
CREATE INDEX idx_cash_register_status ON cash_register(status);

ALTER TABLE cash_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_register_all" ON cash_register FOR ALL TO authenticated USING (true);
