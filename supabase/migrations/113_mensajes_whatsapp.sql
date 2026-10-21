-- 113: Mensajes de WhatsApp personalizables por negocio (Mi negocio > Mensajes de WhatsApp).
--   tenants.whatsapp_messages -> JSON con la plantilla de confirmacion y los bloques opcionales
--   (abono, datos de transferencia, bienvenida, informacion del servicio). NULL = mensajes de siempre.
-- Aditiva y re-ejecutable (IF NOT EXISTS). NO cambia ni borra ningun dato. Hacer un RESPALDO antes.
-- El codigo tolera que falte esta migracion: sin ella todo se ve igual que antes y, al guardar, avisa "Falta aplicar la migracion 113".
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_messages JSONB;

-- Verificacion (debe devolver 1 fila):
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name = 'whatsapp_messages';
