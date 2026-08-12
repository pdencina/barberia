-- Per-barber work schedule (days + hours, different per professional)
CREATE TABLE IF NOT EXISTS barber_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL, -- 0=Domingo, 1=Lunes ... 6=Sábado
  is_working BOOLEAN NOT NULL DEFAULT true,
  start_time TIME NOT NULL DEFAULT '10:00',
  end_time TIME NOT NULL DEFAULT '20:00',
  break_start TIME, -- colación/break
  break_end TIME,
  UNIQUE(barber_id, day_of_week)
);

CREATE INDEX idx_barber_schedule ON barber_schedule(barber_id);

ALTER TABLE barber_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "barber_schedule_all" ON barber_schedule FOR ALL TO authenticated USING (true);

-- Service assignment per barber (which services each barber offers)
-- If a barber has NO entries here, they offer ALL services (backwards compatible)
CREATE TABLE IF NOT EXISTS barber_service_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(barber_id, service_id)
);

CREATE INDEX idx_barber_service_assignments ON barber_service_assignments(barber_id);

ALTER TABLE barber_service_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "barber_service_assignments_all" ON barber_service_assignments FOR ALL TO authenticated USING (true);
