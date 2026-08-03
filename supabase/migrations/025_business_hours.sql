-- Horarios de atención por día de la semana
CREATE TABLE IF NOT EXISTS business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INT NOT NULL, -- 0=Domingo, 1=Lunes ... 6=Sábado
  open_time TIME NOT NULL DEFAULT '10:00',
  close_time TIME NOT NULL DEFAULT '21:00',
  is_closed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(day_of_week)
);

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_hours_read" ON business_hours FOR SELECT TO authenticated USING (true);
CREATE POLICY "business_hours_admin" ON business_hours FOR ALL TO authenticated USING (true);

-- Seed default hours (Lunes a Sábado 10-21, Domingo cerrado)
INSERT INTO business_hours (day_of_week, open_time, close_time, is_closed) VALUES
  (0, '10:00', '21:00', true),   -- Domingo cerrado
  (1, '10:00', '21:00', false),  -- Lunes
  (2, '10:00', '21:00', false),  -- Martes
  (3, '10:00', '21:00', false),  -- Miércoles
  (4, '10:00', '21:00', false),  -- Jueves
  (5, '10:00', '21:00', false),  -- Viernes
  (6, '10:00', '21:00', false)   -- Sábado
ON CONFLICT (day_of_week) DO NOTHING;
