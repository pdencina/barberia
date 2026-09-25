-- Punto (Nico, 25-sep): "Configuracion del negocio" (solo Administrador) — tema
-- claro/oscuro para todo el sistema. Vive a nivel de TENANT, no por usuario, porque el
-- pedido es "el tema de su negocio": todo el equipo de un negocio (admin, recepcion,
-- profesionales) ve el mismo tema elegido por su administrador.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'light';
