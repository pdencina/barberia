-- 187: duración que ve el cliente, separada de la duración que ocupa en la agenda (services.duration). Vacía = se muestra la de la agenda.
-- Aditiva y re-ejecutable.
ALTER TABLE services ADD COLUMN IF NOT EXISTS public_duration integer;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_public_duration_check;
ALTER TABLE services ADD CONSTRAINT services_public_duration_check CHECK (public_duration IS NULL OR public_duration BETWEEN 5 AND 600);
NOTIFY pgrst, 'reload schema';
-- Verificación: debe devolver 1 fila.
SELECT column_name FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'public_duration';
