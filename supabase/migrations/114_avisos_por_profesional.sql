-- 114: Avisos por profesional. Cada persona (admin / recepcion) elige DE QUE PROFESIONALES quiere recibir avisos de citas:
--   pro_filter_mode = 'all'      -> de todos (como hasta hoy; es el valor por defecto)
--                     'own'      -> solo las citas donde ella misma es la profesional
--                     'selected' -> las suyas + las de los profesionales elegidos en pro_filter_ids
-- Aditiva y re-ejecutable (IF NOT EXISTS). NO cambia ni borra ningun dato: todos quedan en 'all' (igual que antes).
-- El codigo tolera que falte esta migracion (se recibe todo como siempre y al guardar avisa "Falta aplicar la migracion 114").
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS pro_filter_mode TEXT NOT NULL DEFAULT 'all';
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS pro_filter_ids UUID[] NOT NULL DEFAULT '{}';

-- Verificacion (debe devolver 2 filas):
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'notification_preferences' AND column_name IN ('pro_filter_mode', 'pro_filter_ids')
ORDER BY column_name;
