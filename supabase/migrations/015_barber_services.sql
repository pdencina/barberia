-- Precios y duracion personalizados por barbero
-- Si un barbero tiene entry aqui, usa esos valores. Si no, usa los default de services.
CREATE TABLE IF NOT EXISTS barber_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  custom_price NUMERIC(10,0), -- null = usa precio default
  custom_duration INTEGER, -- null = usa duracion default
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(barber_id, service_id)
);

CREATE INDEX idx_barber_services ON barber_services(barber_id);

ALTER TABLE barber_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "barber_services_all" ON barber_services FOR ALL TO authenticated USING (true);
CREATE POLICY "barber_services_public" ON barber_services FOR SELECT TO anon USING (true);
