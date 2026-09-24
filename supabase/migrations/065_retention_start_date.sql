-- Punto 13 (Pablo): las metricas de retencion no deben considerar periodos
-- anteriores a la fecha en que el negocio realmente empezo a usar re-booking,
-- para no distorsionar las estadisticas con datos de antes de que el sistema
-- tuviera informacion real (pruebas iniciales, importaciones, etc.).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS retention_start_date DATE;

COMMENT ON COLUMN tenants.retention_start_date IS
  'Fecha desde la cual se calculan las metricas de retencion (Punto 13). NULL = usar tenants.created_at (comportamiento automatico para negocios nuevos).';

-- Estudio Levels: fecha inicial fijada explicitamente por Pablo en 1 de septiembre 2026.
UPDATE tenants SET retention_start_date = '2026-09-01' WHERE slug = 'estudiolevels';
