-- 149: de qué campaña vino cada alta de re-booking (Píxel de Meta). Aditiva y re-ejecutable.
-- Guarda utm_*, fbclid, fbp, fbc y la página de origen. NO guarda correo ni teléfono extra (eso ya está en la solicitud).
ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS ad_attribution JSONB;
CREATE INDEX IF NOT EXISTS signup_requests_campaign_idx ON signup_requests ((ad_attribution->>'utm_campaign'));

-- Verificación: debe devolver 1 fila.
SELECT column_name FROM information_schema.columns WHERE table_name = 'signup_requests' AND column_name = 'ad_attribution';
