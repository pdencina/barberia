-- BORRADOR — NO EJECUTAR
-- INFERENCIA: contrato para revisión de Claude, no despliegue ni cron.
-- HECHO: profile/tenant existen en supabase/migrations/001_initial_schema.sql:13
-- y supabase/migrations/028_multi_tenant.sql:5,81.
-- DESCONOCIDO: retención (ESPECIFICACION.md, pregunta 10), Nico decide.
-- Sin HTML, correo, texto de citas, nombres de clientes ni mensajes de error libres.

CREATE TABLE IF NOT EXISTS public.agent_admin_report_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_date date NOT NULL CHECK (isfinite(report_date)),
  purpose text NOT NULL CHECK (purpose = 'informe-admin-v1'),
  status text NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'procesando', 'aceptado_proveedor', 'fallido', 'incierto')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  provider_accepted_at timestamptz,
  provider_message_id text,
  CONSTRAINT agent_admin_report_delivery_once UNIQUE (profile_id, report_date, purpose),
  CONSTRAINT agent_admin_report_delivery_started CHECK (
    status = 'pendiente' OR (attempts > 0 AND started_at IS NOT NULL)
  ),
  CONSTRAINT agent_admin_report_delivery_finished CHECK (
    status NOT IN ('aceptado_proveedor', 'fallido', 'incierto') OR finished_at IS NOT NULL
  ),
  CONSTRAINT agent_admin_report_delivery_accepted CHECK (
    status <> 'aceptado_proveedor' OR provider_accepted_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS agent_admin_report_deliveries_tenant_date_idx
  ON public.agent_admin_report_deliveries (tenant_id, report_date);

ALTER TABLE public.agent_admin_report_deliveries ENABLE ROW LEVEL SECURITY;
-- No políticas: navegador sin acceso. Service_role omite RLS; servidor valida tenant.
REVOKE ALL ON TABLE public.agent_admin_report_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_admin_report_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.agent_admin_report_delivery_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = NEW.profile_id AND p.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Perfil y negocio no coinciden';
    END IF;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
      OR NEW.report_date IS DISTINCT FROM OLD.report_date
      OR NEW.purpose IS DISTINCT FROM OLD.purpose THEN
      RAISE EXCEPTION 'La identidad del envío es inmutable';
    END IF;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_admin_report_delivery_validate() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_admin_report_delivery_validate() TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.agent_admin_report_deliveries'::regclass
      AND tgname = 'agent_admin_report_delivery_validate_trigger' AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER agent_admin_report_delivery_validate_trigger
      BEFORE INSERT OR UPDATE ON public.agent_admin_report_deliveries
      FOR EACH ROW EXECUTE FUNCTION public.agent_admin_report_delivery_validate();
  END IF;
END;
$$;

-- INFERENCIA: reclamo futuro en UNA sentencia INSERT con status='procesando',
-- attempts=1 y started_at; ON CONFLICT (profile_id, report_date, purpose)
-- DO NOTHING RETURNING id. Solo quien obtiene id puede continuar al proveedor.
-- Si se crean filas pendientes antes, usar UPDATE ... SET status='procesando',
-- attempts=attempts+1, started_at=now() WHERE status='pendiente' RETURNING id.
-- Nunca SELECT seguido de UPDATE sin condición. No resetear aceptado/incierto.
-- La tabla no realiza llamadas de red; no garantiza entrega exactamente una vez.
-- Caída con estado procesando requiere conciliación; ningún timeout autoriza reenvío.
-- Política de fallos/reintentos y límites: pregunta 22; NO decididos aquí.
-- HECHO: Nico/Claude piden CASCADE al borrar el perfil o negocio (27 oct. 2026).
-- Retención DESCONOCIDO: sin TTL, purge ni job de limpieza (#10).
-- Aditivo/re-ejecutable para el mismo esquema; IF NOT EXISTS no repara drift previo.
