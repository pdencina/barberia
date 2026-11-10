-- 163: el codigo del totem pasa a ser del CLIENTE (fijo, no cambia por cita). Aditiva y re-ejecutable.
--  * clients.checkin_code: 5 letras/numeros (sin O/0/I/1), unico por negocio. Se asigna al crear el cliente y a todos los existentes.
--  * appointments.checkin_code ahora copia el codigo del cliente (varias citas del mismo cliente comparten codigo).
--  * se reemplaza el indice unico por (negocio, fecha, codigo) por uno NO unico (ya no puede ser unico).

ALTER TABLE clients ADD COLUMN IF NOT EXISTS checkin_code text;
CREATE UNIQUE INDEX IF NOT EXISTS clients_checkin_code_uq ON clients (tenant_id, checkin_code) WHERE checkin_code IS NOT NULL;
DROP INDEX IF EXISTS appointments_checkin_code_dia_uq;
CREATE INDEX IF NOT EXISTS appointments_checkin_code_idx ON appointments (tenant_id, checkin_code) WHERE checkin_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generar_codigo_cliente(p_tenant uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  codigo text;
  intento int := 0;
BEGIN
  LOOP
    codigo := '';
    FOR i IN 1..5 LOOP
      codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM clients WHERE tenant_id IS NOT DISTINCT FROM p_tenant AND checkin_code = codigo)
       AND NOT EXISTS (SELECT 1 FROM appointments WHERE tenant_id IS NOT DISTINCT FROM p_tenant AND client_id IS NULL AND checkin_code = codigo) THEN
      RETURN codigo;
    END IF;
    intento := intento + 1;
    IF intento > 50 THEN RETURN NULL; END IF; -- nunca bloquea la creacion de un cliente
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.trg_clients_checkin_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.checkin_code IS NULL THEN
    NEW.checkin_code := public.generar_codigo_cliente(NEW.tenant_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS clients_checkin_code ON clients;
CREATE TRIGGER clients_checkin_code BEFORE INSERT ON clients FOR EACH ROW EXECUTE FUNCTION public.trg_clients_checkin_code();

-- La cita copia el codigo de su cliente (si el cliente aun no tiene, se le crea). Sin cliente: codigo propio como antes.
CREATE OR REPLACE FUNCTION public.trg_appointments_checkin_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c text;
BEGIN
  IF NEW.checkin_code IS NULL THEN
    IF NEW.client_id IS NOT NULL THEN
      SELECT checkin_code INTO c FROM clients WHERE id = NEW.client_id;
      IF c IS NULL THEN
        c := public.generar_codigo_cliente(NEW.tenant_id);
        UPDATE clients SET checkin_code = c WHERE id = NEW.client_id AND checkin_code IS NULL;
        SELECT checkin_code INTO c FROM clients WHERE id = NEW.client_id;
      END IF;
      NEW.checkin_code := c;
    ELSE
      NEW.checkin_code := public.generar_codigo_cliente(NEW.tenant_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Los rellenos no deben cambiar la fecha de "ultima modificacion" de clientes ni citas: se apagan esos disparadores solo durante el relleno.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_clients_updated_at') THEN ALTER TABLE clients DISABLE TRIGGER tr_clients_updated_at; END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_appointments_updated_at') THEN ALTER TABLE appointments DISABLE TRIGGER tr_appointments_updated_at; END IF;
END $$;

-- Codigo para TODOS los clientes existentes que no lo tengan.
DO $$
DECLARE r record; c text;
BEGIN
  FOR r IN SELECT id, tenant_id FROM clients WHERE checkin_code IS NULL LOOP
    c := public.generar_codigo_cliente(r.tenant_id);
    IF c IS NOT NULL THEN UPDATE clients SET checkin_code = c WHERE id = r.id; END IF;
  END LOOP;
END $$;

-- Citas de hoy en adelante: pasan a usar el codigo de su cliente.
UPDATE appointments a SET checkin_code = c.checkin_code
  FROM clients c
 WHERE a.client_id = c.id AND c.checkin_code IS NOT NULL
   AND a.checkin_code IS DISTINCT FROM c.checkin_code
   AND a.date >= (now() AT TIME ZONE 'America/Santiago')::date;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_clients_updated_at') THEN ALTER TABLE clients ENABLE TRIGGER tr_clients_updated_at; END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_appointments_updated_at') THEN ALTER TABLE appointments ENABLE TRIGGER tr_appointments_updated_at; END IF;
END $$;

-- Verificacion: clientes sin codigo = 0 y citas futuras con codigo distinto al de su cliente = 0.
SELECT
  (SELECT count(*) FROM clients WHERE checkin_code IS NULL) AS clientes_sin_codigo_0,
  (SELECT count(*) FROM appointments a JOIN clients c ON c.id = a.client_id WHERE a.date >= (now() AT TIME ZONE 'America/Santiago')::date AND a.checkin_code IS DISTINCT FROM c.checkin_code) AS citas_con_otro_codigo_0,
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'clients_checkin_code') AS disparador_clientes_1;
