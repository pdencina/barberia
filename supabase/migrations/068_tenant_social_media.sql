-- Punto 22 (Pablo): el alta de un negocio nuevo en Superadmin ya pedia nombre, slug,
-- direccion, telefono y website, pero faltaba un campo para redes sociales (Instagram,
-- Facebook, etc.). logo_url y website ya existian (migraciones 028 y 058).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS social_media TEXT;
