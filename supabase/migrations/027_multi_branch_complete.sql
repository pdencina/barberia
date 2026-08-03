-- Completar estructura multi-sucursal

-- Add branch_id to remaining tables
ALTER TABLE cash_register ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE business_hours ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cash_register_branch ON cash_register(branch_id);

-- Update default branch name
UPDATE branches SET name = 're-booking Puente Alto' WHERE slug = 'puente-alto';

-- Assign existing data to default branch (uncomment and run once)
-- DO $$
-- DECLARE default_branch UUID;
-- BEGIN
--   SELECT id INTO default_branch FROM branches WHERE slug = 'puente-alto';
--   UPDATE profiles SET branch_id = default_branch WHERE branch_id IS NULL;
--   UPDATE appointments SET branch_id = default_branch WHERE branch_id IS NULL;
--   UPDATE transactions SET branch_id = default_branch WHERE branch_id IS NULL;
--   UPDATE cash_register SET branch_id = default_branch WHERE branch_id IS NULL;
-- END $$;
