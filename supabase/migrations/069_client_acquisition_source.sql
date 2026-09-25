-- Punto 10 (Pablo) - segunda vuelta: Metricas de Clientes aparecia vacia porque el
-- origen se derivaba SOLO de la primera cita del cliente (appointments.source, migracion
-- 067). Eso dejaba afuera a cualquier cliente creado sin cita: alta manual desde el boton
-- "Nuevo" en Clientes, importacion masiva CSV/Excel, etc. — que en la practica es la
-- mayoria de la base historica de Estudio Levels.
--
-- El origen pasa a vivir en el propio cliente, fijado UNA VEZ al momento de su creacion:
--   'link'      -> se creo solo, reservando desde el link publico de re-booking
--                  (negocio o profesional) o pagando el deposito de una reserva por link.
--   'manual'    -> lo creo un profesional/recepcion/admin/super_admin desde el boton
--                  "Nuevo" en Clientes, SIN marcar que llego por promocion.
--   'promotion' -> igual que 'manual', pero en ese mismo formulario se marco que el
--                  cliente llego por una promocion (codigo de descuento, influencer, etc).
--                  acquisition_detail guarda ese codigo/nombre si lo escribieron.
--   NULL        -> "Sin registrar": clientes de bases de datos antiguas (import CSV/Excel,
--                  Setmore, etc.) o cualquier cliente creado antes de este cambio, sobre
--                  los que no tenemos control real de como llegaron.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS acquisition_source TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS acquisition_detail TEXT DEFAULT NULL;

-- Backfill: para clientes que ya existen y aun no tienen acquisition_source, se
-- aprovecha la señal que appointments.source (migracion 067) ya venia registrando desde
-- que se desplego, tomando el origen de su cita mas antigua con source no nulo. Nunca
-- pisa un acquisition_source ya seteado (no deberia haber ninguno todavia, pero es
-- defensivo). Los clientes sin ninguna cita con source quedan en NULL = "Sin registrar",
-- que es exactamente el bucket 4 que pidio Pablo para la base historica.
UPDATE clients c
SET acquisition_source = sub.source
FROM (
  SELECT DISTINCT ON (client_id) client_id, source
  FROM appointments
  WHERE client_id IS NOT NULL AND source IS NOT NULL
  ORDER BY client_id, date ASC, start_time ASC
) sub
WHERE c.id = sub.client_id AND c.acquisition_source IS NULL;
