-- 178: Color principal que el negocio elige para su página de reservas (por ejemplo rojo, dorado, rosado).
-- NULL = el color de siempre de re-booking. Aditiva y re-ejecutable.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS client_accent text;

-- Verificación: debe devolver 1 fila
SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'client_accent';
