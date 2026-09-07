-- Readable, unique per-professional booking slug (e.g. "bastian-ahumada") so each
-- barber gets a short, unambiguous personal link like:
--   re-booking.cl/b/estudiolevels/bastian-ahumada
-- The old links matched by normalized display name, which collided/aimed at the wrong
-- barber ("any available barber"). A stored unique slug removes that ambiguity.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS booking_slug TEXT;

-- Backfill a slug for existing professionals from their name. Deduplicate by appending
-- a short suffix from the id when two names would collide.
DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR r IN SELECT id, name FROM profiles WHERE booking_slug IS NULL AND name IS NOT NULL LOOP
    -- Strip Spanish accents with translate (no extensions needed), lowercase, then
    -- turn any run of non-alphanumeric chars into a single hyphen.
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_booking_slug ON profiles(booking_slug) WHERE booking_slug IS NOT NULL;
