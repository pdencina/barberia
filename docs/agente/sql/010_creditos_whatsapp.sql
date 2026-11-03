-- Créditos de WhatsApp para mensajes que ENVÍA re-booking por la API de Meta (plantillas). Aditiva y re-ejecutable.
-- No toca el cupo antiguo (plan_limits.whatsapp_quota cuenta links wa.me manuales, que no cuestan).
-- Apagado por defecto por negocio (tenants.wa_credits_enabled). Se prueba primero en "rebooking Base"; producción con OK de Nico.
-- 1 crédito = 1 mensaje de utilidad (recordatorio); un mensaje de marketing vale `marketing_cost` créditos (precios en wa_credit_settings).

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS wa_credits_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS wa_credits_override integer CHECK (wa_credits_override IS NULL OR wa_credits_override >= 0);

CREATE TABLE IF NOT EXISTS public.wa_credit_plan (
  plan text PRIMARY KEY,
  monthly_credits integer NOT NULL DEFAULT 0 CHECK (monthly_credits >= 0)
);
INSERT INTO public.wa_credit_plan (plan, monthly_credits) VALUES ('basic', 0), ('starter', 0), ('pro', 200), ('enterprise', 800)
ON CONFLICT (plan) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.wa_credit_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  marketing_cost integer NOT NULL DEFAULT 4 CHECK (marketing_cost >= 1),
  welcome_credits integer NOT NULL DEFAULT 100 CHECK (welcome_credits >= 0),
  pack_months integer NOT NULL DEFAULT 12 CHECK (pack_months >= 1),
  packs jsonb NOT NULL DEFAULT '[{"credits":250,"price_clp":12990},{"credits":1000,"price_clp":39990}]'::jsonb
);
INSERT INTO public.wa_credit_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.wa_credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  credits integer NOT NULL CHECK (credits > 0),
  price_clp integer CHECK (price_clp IS NULL OR price_clp >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 months')
);
CREATE INDEX IF NOT EXISTS wa_credit_packs_tenant_idx ON public.wa_credit_packs (tenant_id);

CREATE TABLE IF NOT EXISTS public.wa_credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  credits integer NOT NULL CHECK (credits > 0),
  tipo text NOT NULL CHECK (tipo IN ('utility', 'marketing')),
  from_pack boolean NOT NULL DEFAULT false,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_credit_usage_tenant_idx ON public.wa_credit_usage (tenant_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS wa_credit_usage_ref_idx ON public.wa_credit_usage (tenant_id, tipo, reference_id) WHERE reference_id IS NOT NULL;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['wa_credit_plan', 'wa_credit_settings', 'wa_credit_packs', 'wa_credit_usage'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

-- Verificación (4 tablas; planes con créditos; negocios con créditos activos debe ser 0):
SELECT to_regclass('public.wa_credit_plan') AS planes, to_regclass('public.wa_credit_settings') AS ajustes,
       to_regclass('public.wa_credit_packs') AS packs, to_regclass('public.wa_credit_usage') AS uso,
       (SELECT count(*) FROM public.wa_credit_plan) AS planes_cargados,
       (SELECT count(*) FROM public.tenants WHERE wa_credits_enabled) AS negocios_activos;
