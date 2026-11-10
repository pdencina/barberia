-- 158 · re-booking Empresas, Etapa 2: configuración por empresa, cartera por vendedor, gestiones y reporte semanal.
-- Aditiva y re-ejecutable. Requiere la 153 y la 154. No toca tablas de salones.
-- Todo lo nuevo viene apagado: el reporte por correo y el portal se encienden por empresa en company_settings.

-- Configuración por empresa. Una fila por empresa; si no existe, el servidor usa los mismos valores por defecto.
CREATE TABLE IF NOT EXISTS public.company_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  contact_every_days integer NOT NULL DEFAULT 30 CHECK (contact_every_days BETWEEN 1 AND 365),       -- cada cuánto se llama a cada cliente
  no_answer_retry_days integer NOT NULL DEFAULT 2 CHECK (no_answer_retry_days BETWEEN 0 AND 60),     -- tras "no contestó", cuándo vuelve a la cola
  max_no_answer_attempts integer NOT NULL DEFAULT 3 CHECK (max_no_answer_attempts BETWEEN 1 AND 20), -- intentos antes de darlo por intentado este ciclo
  weekly_report_enabled boolean NOT NULL DEFAULT false,
  portal_enabled boolean NOT NULL DEFAULT false,
  portal_stock_mode text NOT NULL DEFAULT 'availability' CHECK (portal_stock_mode IN ('availability', 'exact')),
  portal_show_prices boolean NOT NULL DEFAULT true,
  portal_warehouse_id uuid,        -- bodega desde la que se arman los pedidos del portal; vacía = la primera activa
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS tr_company_settings_kind ON public.company_settings;
CREATE TRIGGER tr_company_settings_kind BEFORE INSERT OR UPDATE OF tenant_id ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.company_assert_tenant_kind();
DROP TRIGGER IF EXISTS tr_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER tr_company_settings_updated_at BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Cartera: cada cliente comercial puede tener un vendedor. Sin FK a profiles a propósito (igual que created_by).
ALTER TABLE public.company_customers ADD COLUMN IF NOT EXISTS assigned_seller_id uuid;
CREATE INDEX IF NOT EXISTS company_customers_seller_idx ON public.company_customers (tenant_id, assigned_seller_id);

-- Gestiones: cada llamado o visita con su resultado. Lo escribe solo el servidor.
CREATE TABLE IF NOT EXISTS public.company_customer_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  result text NOT NULL CHECK (result IN ('sold', 'no_answer', 'callback', 'not_interested', 'skipped')),
  callback_on date,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  skip_reason text CHECK (skip_reason IS NULL OR char_length(skip_reason) <= 500),
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (customer_id, tenant_id) REFERENCES public.company_customers (id, tenant_id),
  CONSTRAINT company_customer_activities_callback_check CHECK (result <> 'callback' OR callback_on IS NOT NULL),
  CONSTRAINT company_customer_activities_skip_check CHECK (result <> 'skipped' OR skip_reason IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS company_customer_activities_customer_idx ON public.company_customer_activities (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS company_customer_activities_tenant_idx ON public.company_customer_activities (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS company_customer_activities_seller_idx ON public.company_customer_activities (tenant_id, seller_id, created_at DESC);

-- Reporte semanal por correo: una fila por empresa y semana, para no enviarlo dos veces.
CREATE TABLE IF NOT EXISTS public.company_report_runs (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, week_start)
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_customer_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_report_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.company_settings, public.company_customer_activities, public.company_report_runs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.company_settings TO service_role;
-- Las gestiones no se editan ni se borran: son el historial que respalda el reporte.
GRANT SELECT, INSERT ON public.company_customer_activities TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.company_report_runs TO service_role;

NOTIFY pgrst, 'reload schema';

-- Verificación (debe devolver: 3 tablas con RLS, 0 políticas, 1 columna de cartera):
-- SELECT
--   (SELECT count(*) FROM pg_class WHERE relname IN ('company_settings','company_customer_activities','company_report_runs') AND relrowsecurity) AS tablas_con_rls,
--   (SELECT count(*) FROM pg_policies WHERE tablename IN ('company_settings','company_customer_activities','company_report_runs')) AS politicas,
--   (SELECT count(*) FROM information_schema.columns WHERE table_name = 'company_customers' AND column_name = 'assigned_seller_id') AS cartera;
