-- Slot duration per professional (in minutes)
-- Only super admin can modify this
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slot_duration INT NOT NULL DEFAULT 45;
-- Examples: 30 = owner cuts every 30min, 45 = standard barber
