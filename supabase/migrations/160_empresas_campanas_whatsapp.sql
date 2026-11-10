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
