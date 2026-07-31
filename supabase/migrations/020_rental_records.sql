-- Registros mensuales de arriendo (cierre por profesional)
CREATE TABLE IF NOT EXISTS rental_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES profiles(id),
  month INTEGER NOT NULL, -- 1-12
  year INTEGER NOT NULL,
  days_worked INTEGER NOT NULL,
  daily_rate NUMERIC(10,0) NOT NULL,
  gross_amount NUMERIC(10,0) NOT NULL, -- days × rate
  deductions NUMERIC(10,0) NOT NULL DEFAULT 0, -- aseo, consumibles
  product_bonus NUMERIC(10,0) NOT NULL DEFAULT 0, -- bono por venta de productos
  net_amount NUMERIC(10,0) NOT NULL, -- gross - deductions + bonus
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(barber_id, month, year)
);

ALTER TABLE rental_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rental_records_all" ON rental_records FOR ALL TO authenticated USING (true);
