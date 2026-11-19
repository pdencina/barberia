-- 175: tótems independientes por módulo (Módulo 1, 2...). Aditiva y re-ejecutable.
--  * tenants.kiosk_modules: cuántos tótems (módulos) tiene el local (1 por defecto).
--  * kiosk_payments.module: desde qué módulo se creó cada cobro.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kiosk_modules integer NOT NULL DEFAULT 1;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_kiosk_modules_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_kiosk_modules_check CHECK (kiosk_modules BETWEEN 1 AND 9);
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS module smallint;

-- Verificacion: 2 columnas nuevas.
SELECT count(*) AS columnas_2 FROM information_schema.columns
WHERE (table_name='tenants' AND column_name='kiosk_modules') OR (table_name='kiosk_payments' AND column_name='module');
