-- BORRADOR — NO EJECUTAR
-- HECHO: tenants.id: supabase/migrations/028_multi_tenant.sql:5;
-- appointments.id/client_id: supabase/migrations/001_initial_schema.sql:97-105;
-- appointments.tenant_id: supabase/migrations/045_tenant_isolation.sql:4.
-- Decisiones de Nico #10/#14/R3: retención 15..30 (default 30), sin texto y baja automática.
-- INFERENCIA: contrato de tablas para B; no activa envíos ni crea rutas/jobs.

CREATE TABLE IF NOT EXISTS public.agent_whatsapp_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  retention_days integer NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 15 AND 30),
  phone_number_id text UNIQUE CHECK (
    phone_number_id IS NULL OR (phone_number_id <> '' AND phone_number_id = btrim(phone_number_id))
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT enabled OR phone_number_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.agent_contact_optouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_hash text NOT NULL CHECK (contact_hash ~ '^[a-f0-9]{64}$'),
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('respuesta_cliente', 'manual')),
  CONSTRAINT agent_contact_optouts_once UNIQUE (tenant_id, contact_hash)
);
-- INFERENCIA: el servidor aplica HMAC-SHA256(sal, JSON.stringify([
-- "agente:contacto:v1", tenant_id, remitente_canonico])) y guarda SOLO el hex.
-- Misma fórmula de la pieza A whatsapp-meta.ts; sal inyectada, nunca en tablas/logs.
-- tenant_id es el namespace estable, no phone_number_id: cambiar número no borra bajas.
-- clave-deduplicacion.ts:24-29 no tiene secreto ni hash de contacto; no reemplaza HMAC.
-- Releer baja antes de CADA envío. Cambiar/perder sal invalida búsquedas: requiere diseño
-- de rotación antes de operar; no se almacena teléfono ni se configura sal aquí.

CREATE TABLE IF NOT EXISTS public.agent_reminder_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  purpose text NOT NULL CHECK (purpose = 'recordatorio-cita-v1'),
  status text NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'procesando', 'aceptado_proveedor', 'fallido', 'incierto')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  provider_accepted_at timestamptz,
  CONSTRAINT agent_reminder_deliveries_once UNIQUE (appointment_id, channel, purpose),
  CHECK (status = 'pendiente' OR (attempts > 0 AND started_at IS NOT NULL)),
  CHECK (status NOT IN ('aceptado_proveedor', 'fallido', 'incierto') OR finished_at IS NOT NULL),
  CHECK (status <> 'aceptado_proveedor' OR provider_accepted_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS agent_reminder_deliveries_tenant_idx
  ON public.agent_reminder_deliveries (tenant_id, appointment_id);
CREATE UNIQUE INDEX IF NOT EXISTS agent_reminder_deliveries_provider_idx
  ON public.agent_reminder_deliveries (tenant_id, channel, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.agent_whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_contact_optouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_reminder_deliveries ENABLE ROW LEVEL SECURITY;
-- Sin políticas, navegador sin acceso; service_role omite RLS: B validará identidad/tenant.
REVOKE ALL ON public.agent_whatsapp_settings, public.agent_contact_optouts,
  public.agent_reminder_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_whatsapp_settings,
  public.agent_contact_optouts, public.agent_reminder_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.agent_reminder_delivery_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = NEW.appointment_id AND a.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Cita y negocio no coinciden';
    END IF;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
      OR NEW.channel IS DISTINCT FROM OLD.channel OR NEW.purpose IS DISTINCT FROM OLD.purpose THEN
      RAISE EXCEPTION 'La identidad del recordatorio es inmutable';
    END IF;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_reminder_delivery_validate() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_reminder_delivery_validate() TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.agent_reminder_deliveries'::regclass
      AND tgname = 'agent_reminder_delivery_validate_trigger' AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER agent_reminder_delivery_validate_trigger
      BEFORE INSERT OR UPDATE ON public.agent_reminder_deliveries
      FOR EACH ROW EXECUTE FUNCTION public.agent_reminder_delivery_validate();
  END IF;
END;
$$;

-- Reclamo futuro: INSERT procesando/attempts=1/started_at con ON CONFLICT
-- (appointment_id, channel, purpose) DO NOTHING RETURNING id, una sentencia.
-- No hay texto, teléfono, destinatario ni sal. provider_message_id identifica el envío.
-- DESCONOCIDO: job/plazo operativo de limpieza y rotación de hash; no hay TTL/purge.
-- Borrar una baja por retención NO autoriza recontactar: requiere política específica.
-- HECHO: appointments.client_id NO tiene CASCADE en 001_initial_schema.sql:99.
-- Cliente: borrar citas antes, como src/app/api/clients/bulk-delete/route.ts:69-84;
-- negocio: primero citas y luego padres, según
-- supabase/migrations/072_fix_delete_tenant_cascade_missing_tables.sql:78-145.
-- Este borrador no altera esas FK existentes. Sí limpia su registro al borrar cita/tenant.
-- IF NOT EXISTS permite repetir el MISMO esquema; no repara tablas antiguas distintas.
-- HECHO local (27 oct. 2026): 66 comprobaciones pasan en PGlite0.5.12 efímero,
-- 003->004->005 completos repetidos, RLS/grants/CHECK/unique/reclamo y borrados.
-- Fixture base reducido con FK reales + función072 completa; no todo el esquema.
-- Cliente borrado después de citas, como API existente; negocio por función072.
-- DESCONOCIDO: Supabase, rutas HTTP, datos reales y concurrencia multisession.
