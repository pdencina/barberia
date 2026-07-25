-- ==================== MULTI-SUCURSAL ====================
-- Base structure for supporting multiple branches/locations

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, -- for URL: /booking/puente-alto
  address TEXT,
  phone TEXT,
  email TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Santiago',
  open_time TIME NOT NULL DEFAULT '10:00',
  close_time TIME NOT NULL DEFAULT '21:00',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches_all" ON branches FOR ALL TO authenticated USING (true);
CREATE POLICY "branches_public_read" ON branches FOR SELECT TO anon USING (active = true);

-- Add branch_id to existing tables (nullable for backwards compatibility)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE services ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- Index for branch filtering
CREATE INDEX IF NOT EXISTS idx_appointments_branch ON appointments(branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_branch ON transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_branch ON profiles(branch_id);

-- Insert default branch (current location)
INSERT INTO branches (name, slug, address, phone) VALUES
  ('EstudioLevels Puente Alto', 'puente-alto', '1889 Juan de Dios Malebran, Puente Alto', '9 4266 6172');

-- Assign all existing data to default branch
-- (Run after inserting the branch)
-- UPDATE profiles SET branch_id = (SELECT id FROM branches LIMIT 1) WHERE branch_id IS NULL;
-- UPDATE appointments SET branch_id = (SELECT id FROM branches LIMIT 1) WHERE branch_id IS NULL;
-- UPDATE transactions SET branch_id = (SELECT id FROM branches LIMIT 1) WHERE branch_id IS NULL;
