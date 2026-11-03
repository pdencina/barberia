-- 130 · Productos (cosmeticos) vendidos por profesionales de ARRIENDO. Aditiva y re-ejecutable. Todo apagado por defecto.
--   tenants.rental_product_mode  'off' = como hasta ahora (el producto no suma ni resta) | 'business_collects' = el negocio cobra el producto:
--                                 lo que el profesional recibio se suma a lo que paga (precio menos su comision); lo que recibio el negocio le da su comision.
--   tenants.rental_product_from  fecha desde la que aplica (NULL = todas las ventas).
--   tenants.rental_card_to_barber debito y credito se los lleva el profesional (true) o entran al negocio (false).
--   profiles.rental_transfer_to_barber  la transferencia llega al profesional (true) o a la cuenta del negocio (false, por defecto).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rental_product_mode text NOT NULL DEFAULT 'off';
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_rental_product_mode_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_rental_product_mode_check CHECK (rental_product_mode IN ('off', 'business_collects'));
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rental_product_from date;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rental_card_to_barber boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rental_transfer_to_barber boolean NOT NULL DEFAULT false;

-- Verificacion (debe devolver 4 filas):
-- SELECT table_name, column_name FROM information_schema.columns WHERE (table_name='tenants' AND column_name IN ('rental_product_mode','rental_product_from','rental_card_to_barber')) OR (table_name='profiles' AND column_name='rental_transfer_to_barber');
