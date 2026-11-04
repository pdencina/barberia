-- 128 · Descuento por planilla con varios productos y codigo para pistola. Aditiva y re-ejecutable.
--   items     = lista de productos del descuento (jsonb: product_id, product_name, quantity, unit_price, total). NULL = descuento antiguo de 1 producto.
--   scan_code = codigo largo para escanear con pistola en el Punto de Venta (empieza con "PL-"). El codigo corto (4 caracteres) sigue en "code".
ALTER TABLE payroll_discounts ADD COLUMN IF NOT EXISTS items jsonb;
ALTER TABLE payroll_discounts ADD COLUMN IF NOT EXISTS scan_code text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_discount_scan_code ON payroll_discounts(tenant_id, scan_code) WHERE scan_code IS NOT NULL;

-- Verificacion (debe devolver 2 filas):
-- SELECT column_name FROM information_schema.columns WHERE table_name='payroll_discounts' AND column_name IN ('items', 'scan_code');
