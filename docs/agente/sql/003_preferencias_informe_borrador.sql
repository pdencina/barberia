-- BORRADOR — NO EJECUTAR
-- INFERENCIA: propuesta de preferencias, no migración aprobada. Espera a Claude.
-- HECHO: perfiles tienen id/email/role/active (001_initial_schema.sql:13-23),
-- y tenant_id (028_multi_tenant.sql:81). Decisiones Nico 26 oct. 2026: #15/#18/#19.
-- INFERENCIA: una fila por administrador; NO guarda correo, citas, clientes,
-- llaves, textos, cupos ni registro de entregas. No habilita envíos ni crea cron.
-- DESCONOCIDO: no probado en PostgreSQL ni aplicado a ninguna base.
-- Re-ejecutable sobre este mismo esquema; IF NOT EXISTS no repara una tabla
-- preexistente con estructura distinta: Claude debe revisar compatibilidad.

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
