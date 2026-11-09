-- 150: cada negocio puede conectar SU propio Pixel de Meta (solo el ID, que no es secreto).
-- Aditiva y re-ejecutable. Sin Pixel conectado, la pagina de reservas queda exactamente igual que antes.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_meta_pixel_id_format;
ALTER TABLE tenants ADD CONSTRAINT tenants_meta_pixel_id_format CHECK (meta_pixel_id IS NULL OR meta_pixel_id ~ '^[0-9]{8,20}$');

-- Verificacion: debe devolver 1 fila.
SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'meta_pixel_id';
