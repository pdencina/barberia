-- 151: Opción por negocio para que la página de reservas y los correos al cliente usen los colores del tema del sistema.
-- Aditiva y re-ejecutable. Apagada por defecto (todo queda como antes).
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS client_theme_enabled boolean NOT NULL DEFAULT false;

-- Verificación: debe devolver 1 fila
SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'client_theme_enabled';
