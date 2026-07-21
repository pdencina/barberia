-- Tabla para bloqueos de horario de barberos
CREATE TABLE IF NOT EXISTS barber_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT true,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_barber_blocks_date ON barber_blocks(barber_id, date);

ALTER TABLE barber_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "barber_blocks_all" ON barber_blocks FOR ALL TO authenticated USING (true);
