-- Reviews / Calificaciones de barberos
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID UNIQUE REFERENCES appointments(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  barber_id UUID NOT NULL REFERENCES profiles(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_barber ON reviews(barber_id);
CREATE INDEX idx_reviews_rating ON reviews(barber_id, rating);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_all" ON reviews FOR ALL TO authenticated USING (true);
CREATE POLICY "reviews_public_read" ON reviews FOR SELECT TO anon USING (public = true);
