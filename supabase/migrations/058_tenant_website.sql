-- The Configuracion form had a "Sitio Web" field, but tenants had no column to store
-- it, so it silently never saved. Add it.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS website TEXT;
