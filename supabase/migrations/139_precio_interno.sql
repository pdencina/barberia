-- 139 · Precio interno (o especial) de un producto: es lo que se descuenta al profesional en un "Descuento por planilla".
-- Si queda vacío (NULL), se usa el precio de venta. Aditiva y re-ejecutable.
ALTER TABLE products ADD COLUMN IF NOT EXISTS internal_price numeric(12,2);
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_internal_price_chk;
ALTER TABLE products ADD CONSTRAINT products_internal_price_chk CHECK (internal_price IS NULL OR internal_price >= 0);

-- Verificación (debe devolver 1 fila):
-- SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name='internal_price';
