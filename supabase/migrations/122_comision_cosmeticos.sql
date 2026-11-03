-- 122 · Comisión por venta de cosméticos, por negocio (monto fijo por unidad, en pesos). Aditiva y re-ejecutable.
-- 0 = el negocio no paga comisión por cosméticos (valor por defecto). El administrador lo cambia en Configuración > Equipo.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cosmetic_commission_amount integer NOT NULL DEFAULT 0;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_cosmetic_commission_amount_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_cosmetic_commission_amount_check CHECK (cosmetic_commission_amount >= 0 AND cosmetic_commission_amount <= 1000000);

-- Verificación (debe devolver 1 fila):
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='tenants' AND column_name='cosmetic_commission_amount';
