-- Fotos de cortes en ficha del cliente
CREATE TABLE IF NOT EXISTS client_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES profiles(id),
  url TEXT NOT NULL,
  caption TEXT,
  appointment_id UUID REFERENCES appointments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_photos_client ON client_photos(client_id);

ALTER TABLE client_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_photos_all" ON client_photos FOR ALL TO authenticated USING (true);

-- Create storage bucket for cut photos (run in Supabase dashboard if not auto-created)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('cut-photos', 'cut-photos', true);
