-- 136 · Quién canceló una cita y por qué (para el Dashboard). Aditiva y re-ejecutable.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_by text;       -- client | admin | receptionist | barber | system
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_reason text;      -- clave de lista fija (ver src/lib/cancel-reasons.ts)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Verificación (debe devolver 3 filas):
-- SELECT column_name FROM information_schema.columns WHERE table_name='appointments' AND column_name IN ('cancelled_by','cancel_reason','cancelled_at');
