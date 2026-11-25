-- 177: El negocio elige un diseño de colores PROPIO para sus clientes (página de reservas, reseñas y correos),
-- sin depender del tema que usa su equipo en el sistema. NULL = usar el mismo tema del sistema (como antes).
-- Aditiva y re-ejecutable. Requiere la 151 (client_theme_enabled).
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS client_theme text;

-- Verificación: debe devolver 1 fila
SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'client_theme';
