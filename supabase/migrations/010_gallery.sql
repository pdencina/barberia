-- Galeria de trabajos de barberos
CREATE TABLE IF NOT EXISTS gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  service_id UUID REFERENCES services(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gallery_barber ON gallery(barber_id, active);

ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gallery_all" ON gallery FOR ALL TO authenticated USING (true);
CREATE POLICY "gallery_public_read" ON gallery FOR SELECT TO anon USING (active = true);

-- Storage bucket (create manually in Supabase Dashboard > Storage > New Bucket: "gallery", public)
-- Or via SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('gallery', 'gallery', true);
