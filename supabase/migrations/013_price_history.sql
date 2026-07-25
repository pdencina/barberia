-- Historial de cambios de precios
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'service' or 'product'
  entity_id UUID NOT NULL,
  entity_name TEXT NOT NULL,
  old_price NUMERIC(10,0) NOT NULL,
  new_price NUMERIC(10,0) NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_entity ON price_history(entity_type, entity_id);
CREATE INDEX idx_price_history_date ON price_history(created_at DESC);

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_history_all" ON price_history FOR ALL TO authenticated USING (true);
