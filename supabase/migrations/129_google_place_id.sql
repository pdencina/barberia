-- 129 · ID del lugar en Google (Place ID) para el link directo de reseñas. Aditiva y re-ejecutable.
-- Con el, el boton del correo abre directo el formulario de reseña: https://search.google.com/local/writereview?placeid=<ID>
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_place_id text;

-- Verificacion (debe devolver 1 fila):
-- SELECT column_name FROM information_schema.columns WHERE table_name='tenants' AND column_name='google_place_id';
