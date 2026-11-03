-- 127 · Fecha desde la cual se paga la comision de cosmeticos (por negocio). Aditiva y re-ejecutable.
-- NULL = vale para todas las ventas (como hasta ahora). Con fecha: solo cuentan las ventas de esa fecha en adelante (hora de Chile),
-- asi un mes ya liquidado no cambia al activar la comision.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cosmetic_commission_from date;

-- Verificacion (debe devolver 1 fila):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tenants' AND column_name='cosmetic_commission_from';
