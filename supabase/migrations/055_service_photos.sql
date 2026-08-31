-- Add a reference photo per service (e.g. an example of "perfilado de barba"), shown
-- to the client while choosing services in the public booking flow. Similar to the
-- Setmore-style visual reference requested.
ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT;
