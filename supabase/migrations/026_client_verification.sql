-- Campos para verificación de portal del cliente
ALTER TABLE clients ADD COLUMN IF NOT EXISTS verification_code TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMPTZ;
