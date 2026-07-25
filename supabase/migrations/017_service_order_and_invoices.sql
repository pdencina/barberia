-- Orden de servicios (posicion en la lista)
ALTER TABLE services ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Facturas digitales
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'purchase', -- purchase, expense, other
  description TEXT NOT NULL,
  amount NUMERIC(10,0),
  file_url TEXT NOT NULL,
  file_name TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_all" ON invoices FOR ALL TO authenticated USING (true);

-- Analytics: producto mas vendido (usamos transaction_items que ya existe)
-- No necesita migration, solo query
