-- Lista de espera
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  service_id UUID REFERENCES services(id),
  barber_id UUID REFERENCES profiles(id), -- null = any barber
  preferred_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, notified, booked, expired
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_date ON waitlist(preferred_date, status);
CREATE INDEX idx_waitlist_barber ON waitlist(barber_id, status);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waitlist_all" ON waitlist FOR ALL TO authenticated USING (true);
