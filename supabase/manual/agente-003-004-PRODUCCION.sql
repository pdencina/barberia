-- =====================================================================================================
-- PRODUCCION (proyecto "EstudioLevels", ref ulucmbuvupulwplsrcnx). Informe de citas por administrador: SQL 003 + 004.
-- Dos tablas NUEVAS y vacias (preferencias de cada administrador y registro de envios) con sus reglas de validacion.
-- NO modifica ni borra ninguna tabla ni dato existente. Se puede correr mas de una vez sin problema.
-- Probado: base de prueba en memoria (003 y 004, repetido) y el Supabase de PRUEBAS (ref ucwrdmwtlesayjxmlbve) con consultas reales.
-- ANTES de correr: (1) corre el PASO 0 y confirma el resultado; (2) confirma que el respaldo diario de hoy existe (Database > Backups);
--                  (3) mira la direccion del navegador: debe contener ulucmbuvupulwplsrcnx.
-- =====================================================================================================

-- ------------------------------------------------------------------------------------------------------
-- PASO 0 (solo lectura): comprueba que existen lo que estas tablas necesitan y que aun NO existen las nuevas.
-- Debe dar 1 fila con: tenants = true, profiles = true, rol_admin = true, tabla_preferencias = false, tabla_envios = false
-- ------------------------------------------------------------------------------------------------------
SELECT
  to_regclass('public.tenants') IS NOT NULL AS tenants,
  to_regclass('public.profiles') IS NOT NULL AS profiles,
  EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'admin') AS rol_admin,
  to_regclass('public.agent_admin_report_preferences') IS NOT NULL AS tabla_preferencias,
  to_regclass('public.agent_admin_report_deliveries') IS NOT NULL AS tabla_envios;

-- ------------------------------------------------------------------------------------------------------
-- PASO 1: crear las tablas (003 y 004). Corre desde aqui hasta antes del PASO 2.
-- ------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_admin_report_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'daily'
    CHECK (frequency IN ('daily', 'every_3_days', 'weekly', 'custom')),
  custom_weekdays smallint[] NOT NULL DEFAULT '{}'::smallint[],
  weekly_weekday smallint CHECK (weekly_weekday BETWEEN 0 AND 6),
  anchor_date date,
  send_local_time time without time zone,
  effective_from date,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_admin_report_days_valid CHECK (
    custom_weekdays <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
    AND array_position(custom_weekdays, NULL::smallint) IS NULL
    AND (cardinality(custom_weekdays) = 0 OR array_ndims(custom_weekdays) = 1)
    AND cardinality(custom_weekdays) <= 7
  ),
  CONSTRAINT agent_admin_report_custom_only CHECK (
    frequency = 'custom' OR cardinality(custom_weekdays) = 0
  ),
  CONSTRAINT agent_admin_report_weekly_only CHECK (
    frequency = 'weekly' OR weekly_weekday IS NULL
  ),
  CONSTRAINT agent_admin_report_ready CHECK (
    NOT enabled OR (
      effective_from IS NOT NULL AND send_local_time IS NOT NULL
      AND send_local_time < time '24:00:00'
      AND (frequency <> 'every_3_days' OR anchor_date IS NOT NULL)
      AND (frequency <> 'weekly' OR weekly_weekday IS NOT NULL)
      AND (frequency <> 'custom' OR cardinality(custom_weekdays) > 0)
    )
  )
);

CREATE INDEX IF NOT EXISTS agent_admin_report_preferences_tenant_enabled_idx
  ON public.agent_admin_report_preferences (tenant_id, enabled);

ALTER TABLE public.agent_admin_report_preferences ENABLE ROW LEVEL SECURITY;
-- INFERENCIA: sin políticas de acceso público o autenticado; falla cerrado.
-- Una futura API privilegiada valida sesión, tenant y dueño de la preferencia:
-- propio admin activo o super_admin; nunca otro admin, ni del mismo tenant.
-- RLS no protege de errores de esa API porque service_role lo omite.
REVOKE ALL ON TABLE public.agent_admin_report_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_admin_report_preferences TO service_role;

CREATE OR REPLACE FUNCTION public.agent_admin_report_preferences_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- INFERENCIA: no basta un FK a perfil y otro a tenant: verificar asociación.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.profile_id AND p.tenant_id = NEW.tenant_id
      AND p.role::text = 'admin' AND p.active IS TRUE
  ) THEN
    RAISE EXCEPTION 'La preferencia requiere un administrador activo del negocio';
  END IF;

  IF cardinality(NEW.custom_weekdays) <> (
    SELECT count(DISTINCT day_value) FROM unnest(NEW.custom_weekdays) AS days(day_value)
  ) THEN
    RAISE EXCEPTION 'Los días personalizados no pueden repetirse';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'No se puede reasignar una preferencia a otro perfil o negocio';
    END IF;
    NEW.revision := OLD.revision + 1;
    NEW.created_at := OLD.created_at;
  ELSE
    NEW.revision := 1;
    NEW.created_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_admin_report_preferences_validate() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_admin_report_preferences_validate() TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.agent_admin_report_preferences'::regclass
      AND tgname = 'agent_admin_report_preferences_validate_trigger'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER agent_admin_report_preferences_validate_trigger
      BEFORE INSERT OR UPDATE ON public.agent_admin_report_preferences
      FOR EACH ROW EXECUTE FUNCTION public.agent_admin_report_preferences_validate();
  END IF;
END;
$$;

-- INFERENCIA: cambios posteriores en profiles no actualizan esta preferencia.
-- Antes de CADA envío se relee perfil/tenant/rol/active/email y enabled/revision.
-- Para apagar tras desactivar un perfil, DELETE queda permitido al servicio;
-- si UPDATE se rechaza por rol/actividad, eso no autoriza ningún envío.
-- No hay backfill, INSERT de suscripciones, UPDATE de perfiles ni política abierta.
-- No decidir ancla/hora/día informado/retención/reintentos: sección 11, IA1–IA6.
-- Registro atómico de entregas/deduplicación: FUERA de este borrador; falta diseñar.

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

-- ------------------------------------------------------------------------------------------------------
-- PASO 2 (verificacion): debe dar 1 fila con todo en true y filas = 0
-- ------------------------------------------------------------------------------------------------------
SELECT
  to_regclass('public.agent_admin_report_preferences') IS NOT NULL AS tabla_preferencias,
  to_regclass('public.agent_admin_report_deliveries') IS NOT NULL AS tabla_envios,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.agent_admin_report_preferences'::regclass) AS rls_preferencias,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.agent_admin_report_deliveries'::regclass) AS rls_envios,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.agent_admin_report_preferences'::regclass AND NOT tgisinternal) AS trigger_preferencias,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.agent_admin_report_deliveries'::regclass AND NOT tgisinternal) AS trigger_envios,
  (SELECT count(*) FROM public.agent_admin_report_preferences) + (SELECT count(*) FROM public.agent_admin_report_deliveries) AS filas;

-- ------------------------------------------------------------------------------------------------------
-- DESHACER (solo si hace falta; las tablas son nuevas y nada mas depende de ellas):
--   DROP TABLE IF EXISTS public.agent_admin_report_deliveries;
--   DROP TABLE IF EXISTS public.agent_admin_report_preferences;
--   DROP FUNCTION IF EXISTS public.agent_admin_report_delivery_validate();
--   DROP FUNCTION IF EXISTS public.agent_admin_report_preferences_validate();
-- ------------------------------------------------------------------------------------------------------
