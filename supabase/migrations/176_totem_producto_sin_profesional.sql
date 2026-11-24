-- 176: una compra de CONSUMIBLES (bebidas, energéticas…) en el tótem es del estudio: no necesita profesional. Aditiva y re-ejecutable.
-- Antes la compra de productos exigía barber_id; ahora solo exige el carrito (items). Las compras con cosméticos siguen pidiendo profesional desde el código.
ALTER TABLE kiosk_payments DROP CONSTRAINT IF EXISTS kiosk_payments_origen_check;
ALTER TABLE kiosk_payments ADD CONSTRAINT kiosk_payments_origen_check CHECK ((kind = 'servicio' AND appointment_id IS NOT NULL) OR (kind = 'producto' AND items IS NOT NULL));

-- Verificacion: la restriccion existe (1).
SELECT count(*) AS restriccion_1 FROM pg_constraint WHERE conname = 'kiosk_payments_origen_check';
