-- Notas internas por cliente (preferencias, observaciones)
CREATE TABLE IF NOT EXISTS client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_notes_client ON client_notes(client_id);

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_notes_all" ON client_notes FOR ALL TO authenticated USING (true);
