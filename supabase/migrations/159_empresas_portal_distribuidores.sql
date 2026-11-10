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
