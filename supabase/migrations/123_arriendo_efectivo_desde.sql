-- 123 · Arriendo: desde qué mes se descuenta del arriendo el efectivo de las ventas del profesional que queda en la caja del negocio.
-- Aditiva y re-ejecutable. NULL = no se descuenta (como hasta ahora). Solo aplica a profesionales en arriendo con
-- rental_cash_to_barber = false (el efectivo queda en la caja). Valor: primer día de un mes (ej. 2026-10-01).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rental_cash_settle_from date;

-- Verificación (debe devolver 1 fila):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name='profiles' AND column_name='rental_cash_settle_from';
