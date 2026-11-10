-- 164: el totem de autoatencion es un servicio APARTE (tiene costo mensual): hay que desbloquearlo por negocio.
-- Aditiva y re-ejecutable. Solo el superadministrador cambia kiosk_unlocked (desde Superadmin > Empresas > Editar).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kiosk_unlocked boolean NOT NULL DEFAULT false;

-- Los negocios que ya tenian el totem encendido (Estudio Levels) quedan desbloqueados para no cortarles el servicio.
UPDATE tenants SET kiosk_unlocked = true WHERE kiosk_enabled = true AND kiosk_unlocked = false;

-- Verificacion: desbloqueados = solo los que ya usaban el totem; el resto en false.
SELECT name, kiosk_unlocked, kiosk_enabled FROM tenants WHERE kiosk_unlocked OR kiosk_enabled ORDER BY name;
