-- 181: pago en EFECTIVO desde el totem (el profesional confirma en su celular que recibio el dinero). Aditiva y re-ejecutable.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kiosk_cash_enabled boolean NOT NULL DEFAULT false;

-- Verificacion: 1 columna nueva.
SELECT count(*) AS columnas_1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='kiosk_cash_enabled';
