-- Inventario: aprobacion de movimientos
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
-- status: 'pending', 'approved', 'rejected'
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
