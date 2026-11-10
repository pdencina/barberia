-- re-booking Empresas, Etapas 2 a 4: migraciones 158, 159 y 160 juntas. Correr en Supabase PRODUCCIÓN (EstudioLevels, ID ulucmbuvupulwplsrcnx).
-- Requiere SQL-EMPRESAS.sql (153 a 155) ya corrido. Aditivas y re-ejecutables: no cambian nada de los salones.
-- Todo viene apagado: reporte por correo, portal y envío real de WhatsApp se encienden aparte.

-- ===================== 158_empresas_cartera_gestiones =====================
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

-- ===================== 159_empresas_portal_distribuidores =====================
-- 159 · re-booking Empresas, Etapa 3: portal de distribuidores.
-- Aditiva y re-ejecutable. Requiere la 153, 154 y 158. No toca tablas de salones.
-- Un distribuidor entra con su propia cuenta, ligada a UN cliente comercial de tipo distribuidor. No es miembro de la empresa:
-- no ve el panel, solo /socios. El portal se enciende por empresa (company_settings.portal_enabled, apagado por defecto).

CREATE TABLE IF NOT EXISTS public.company_partner_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  FOREIGN KEY (customer_id, tenant_id) REFERENCES public.company_customers (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS company_partner_users_customer_idx ON public.company_partner_users (tenant_id, customer_id);

DROP TRIGGER IF EXISTS tr_company_partner_users_kind ON public.company_partner_users;
CREATE TRIGGER tr_company_partner_users_kind BEFORE INSERT OR UPDATE OF tenant_id ON public.company_partner_users
  FOR EACH ROW EXECUTE FUNCTION public.company_assert_tenant_kind();
DROP TRIGGER IF EXISTS tr_company_partner_users_updated_at ON public.company_partner_users;
CREATE TRIGGER tr_company_partner_users_updated_at BEFORE UPDATE ON public.company_partner_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- De dónde vino el pedido: panel (vendedor/dueño) o portal (distribuidor). Solo informativo.
ALTER TABLE public.company_orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'panel';
ALTER TABLE public.company_orders DROP CONSTRAINT IF EXISTS company_orders_source_check;
ALTER TABLE public.company_orders ADD CONSTRAINT company_orders_source_check CHECK (source IN ('panel', 'portal'));
-- La 154 solo deja insertar algunas columnas: se suma source.
GRANT INSERT (source) ON public.company_orders TO service_role;

ALTER TABLE public.company_partner_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_partner_users FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.company_partner_users TO service_role;

NOTIFY pgrst, 'reload schema';

-- Verificación (debe devolver: 1 tabla con RLS, 0 políticas, 1 columna source):
-- SELECT
--   (SELECT count(*) FROM pg_class WHERE relname = 'company_partner_users' AND relrowsecurity) AS tabla_con_rls,
--   (SELECT count(*) FROM pg_policies WHERE tablename = 'company_partner_users') AS politicas,
--   (SELECT count(*) FROM information_schema.columns WHERE table_name = 'company_orders' AND column_name = 'source') AS origen;

-- ===================== 160_empresas_campanas_whatsapp =====================
-- 160 · re-booking Empresas, Etapa 4: campañas programadas por WhatsApp.
-- Aditiva y re-ejecutable. Requiere la 153, 154 y 158. No toca tablas de salones.
-- El envío real está BLOQUEADO: sin EMPRESAS_WHATSAPP_SEND=1 en el servidor, cada envío queda como "simulado".
-- Solo reciben clientes con permiso explícito (whatsapp_opt_in) y que no se hayan dado de baja (agent_contact_optouts).

ALTER TABLE public.company_customers ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.company_customers ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at timestamptz;

CREATE TABLE IF NOT EXISTS public.company_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  template_name text NOT NULL,   -- plantilla aprobada por Meta (la regla va abajo)
  template_language text NOT NULL DEFAULT 'es' CHECK (template_language ~ '^[a-z]{2}(_[A-Z]{2})?$'),
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'clients', 'distributors')),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sending', 'done', 'cancelled')),
  created_by uuid NOT NULL,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id)
);
-- Postgres no acepta {1,512} en una expresión regular (máximo 255): se valida el largo aparte.
ALTER TABLE public.company_campaigns DROP CONSTRAINT IF EXISTS company_campaigns_template_name_check;
ALTER TABLE public.company_campaigns ADD CONSTRAINT company_campaigns_template_name_check
  CHECK (template_name ~ '^[a-z0-9_]+$' AND char_length(template_name) <= 512);
CREATE INDEX IF NOT EXISTS company_campaigns_due_idx ON public.company_campaigns (status, scheduled_at);
CREATE INDEX IF NOT EXISTS company_campaigns_tenant_idx ON public.company_campaigns (tenant_id, scheduled_at DESC);

DROP TRIGGER IF EXISTS tr_company_campaigns_kind ON public.company_campaigns;
CREATE TRIGGER tr_company_campaigns_kind BEFORE INSERT OR UPDATE OF tenant_id ON public.company_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.company_assert_tenant_kind();
DROP TRIGGER IF EXISTS tr_company_campaigns_updated_at ON public.company_campaigns;
CREATE TRIGGER tr_company_campaigns_updated_at BEFORE UPDATE ON public.company_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Un registro por cliente y campaña: la llave única impide mandarle dos veces la misma campaña.
CREATE TABLE IF NOT EXISTS public.company_campaign_sends (
  campaign_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('simulated', 'sent', 'failed', 'uncertain', 'skipped_optout', 'skipped_no_phone')),
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, customer_id),
  FOREIGN KEY (campaign_id, tenant_id) REFERENCES public.company_campaigns (id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id, tenant_id) REFERENCES public.company_customers (id, tenant_id)
);

ALTER TABLE public.company_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_campaign_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_campaigns, public.company_campaign_sends FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.company_campaigns TO service_role;
GRANT SELECT, INSERT ON public.company_campaign_sends TO service_role;
-- Cada envío se reclama antes de llamar a Meta (estado "uncertain") y después se anota el resultado: así un corte nunca manda dos veces.
GRANT UPDATE (status, provider_id) ON public.company_campaign_sends TO service_role;

NOTIFY pgrst, 'reload schema';

-- Verificación (debe devolver: 2 tablas con RLS, 0 políticas, 2 columnas de permiso):
-- SELECT
--   (SELECT count(*) FROM pg_class WHERE relname IN ('company_campaigns','company_campaign_sends') AND relrowsecurity) AS tablas_con_rls,
--   (SELECT count(*) FROM pg_policies WHERE tablename IN ('company_campaigns','company_campaign_sends')) AS politicas,
--   (SELECT count(*) FROM information_schema.columns WHERE table_name = 'company_customers' AND column_name IN ('whatsapp_opt_in','whatsapp_opt_in_at')) AS permiso;

-- ===================== VERIFICACIÓN (debe salir: tablas_nuevas = 6, politicas = 0, columnas = 4) =====================
SELECT
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relrowsecurity
     AND c.relname IN ('company_settings','company_customer_activities','company_report_runs','company_partner_users','company_campaigns','company_campaign_sends')) AS tablas_nuevas,
  (SELECT count(*) FROM pg_policies WHERE tablename IN ('company_settings','company_customer_activities','company_report_runs','company_partner_users','company_campaigns','company_campaign_sends')) AS politicas,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND
     ((table_name = 'company_customers' AND column_name IN ('assigned_seller_id','whatsapp_opt_in','whatsapp_opt_in_at')) OR (table_name = 'company_orders' AND column_name = 'source'))) AS columnas;
