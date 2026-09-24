-- Punto 14 (Pablo): "el sistema sigue generando una URL larga". La migracion 062
-- solo relleno booking_slug una vez, para los profesionales que existian en ese
-- momento — nada en el codigo de la app lo seteaba para uno nuevo (corregido ahora
-- en POST/PATCH /api/barberos), asi que cualquier profesional creado despues de esa
-- migracion se quedo sin slug y su link personal cae al feo "/pro/{uuid}". Repite el
-- mismo backfill, ahora para cualquiera que siga sin booking_slug.
DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR r IN SELECT id, name FROM profiles WHERE booking_slug IS NULL AND name IS NOT NULL LOOP
    base := lower(translate(r.name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'));
    base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
    base := trim(both '-' from base);
    IF base = '' THEN base := 'profesional'; END IF;
    candidate := base;
    n := 0;
    WHILE EXISTS (SELECT 1 FROM profiles WHERE booking_slug = candidate) LOOP
      n := n + 1;
      candidate := base || '-' || substr(r.id::text, 1, 4);
      IF n > 1 THEN candidate := base || '-' || substr(r.id::text, 1, 4 + n); END IF;
    END LOOP;
    UPDATE profiles SET booking_slug = candidate WHERE id = r.id;
  END LOOP;
END $$;
