-- 173: QR de WhatsApp y de la página web del negocio en el tótem. Aditiva y re-ejecutable.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kiosk_whatsapp text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kiosk_web text;

-- Verificacion: 2 columnas nuevas.
SELECT count(*) AS columnas_2 FROM information_schema.columns WHERE table_name='tenants' AND column_name IN ('kiosk_whatsapp','kiosk_web');
