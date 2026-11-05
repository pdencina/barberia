-- 138 · Cancelaciones: la cuenta exacta que canceló y por qué canal (link del cliente, portal o el panel). Aditiva y re-ejecutable.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_by_user uuid;   -- profiles.id de quien canceló desde el panel (sin FK a propósito)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_channel text;      -- link | portal | panel

-- Verificación (debe devolver 2 filas):
-- SELECT column_name FROM information_schema.columns WHERE table_name='appointments' AND column_name IN ('cancelled_by_user','cancel_channel');
