-- 161 · re-booking Empresas: tramos de precio mayorista por distribuidor (respuesta de Felipe, 10 nov. 2026).
-- Aditiva y re-ejecutable. Requiere la 153, 154 y 158. No toca tablas de salones.
-- Cada tramo es un descuento sobre el precio de lista (ej.: Mayorista 1 = 5% menos). El rango de compras (min/max en pesos)
-- solo sirve para SUGERIR el tramo; el tramo de cada cliente lo asigna el administrador. Sin tramo = precio de lista.

CREATE TABLE IF NOT EXISTS public.company_price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  discount_pct numeric(5, 2) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 90),
  min_amount numeric(14, 0) CHECK (min_amount IS NULL OR min_amount >= 0),
  max_amount numeric(14, 0) CHECK (max_amount IS NULL OR max_amount >= 0),
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  CONSTRAINT company_price_tiers_range_check CHECK (min_amount IS NULL OR max_amount IS NULL OR max_amount >= min_amount)
);
CREATE INDEX IF NOT EXISTS company_price_tiers_tenant_idx ON public.company_price_tiers (tenant_id, sort);

DROP TRIGGER IF EXISTS tr_company_price_tiers_kind ON public.company_price_tiers;
CREATE TRIGGER tr_company_price_tiers_kind BEFORE INSERT OR UPDATE OF tenant_id ON public.company_price_tiers
  FOR EACH ROW EXECUTE FUNCTION public.company_assert_tenant_kind();
DROP TRIGGER IF EXISTS tr_company_price_tiers_updated_at ON public.company_price_tiers;
CREATE TRIGGER tr_company_price_tiers_updated_at BEFORE UPDATE ON public.company_price_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Tramo del cliente. La FK compuesta impide asignarle el tramo de otra empresa.
ALTER TABLE public.company_customers ADD COLUMN IF NOT EXISTS price_tier_id uuid;
ALTER TABLE public.company_customers DROP CONSTRAINT IF EXISTS company_customers_price_tier_fk;
ALTER TABLE public.company_customers ADD CONSTRAINT company_customers_price_tier_fk
  FOREIGN KEY (price_tier_id, tenant_id) REFERENCES public.company_price_tiers (id, tenant_id);

ALTER TABLE public.company_price_tiers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_price_tiers FROM PUBLIC, anon, authenticated, service_role;
-- Los tramos no se borran (los clientes los referencian): se desactivan.
GRANT SELECT, INSERT, UPDATE ON public.company_price_tiers TO service_role;

NOTIFY pgrst, 'reload schema';

-- Verificación (debe devolver: 1 tabla con RLS, 0 políticas, 1 columna de tramo):
-- SELECT
--   (SELECT count(*) FROM pg_class WHERE relname = 'company_price_tiers' AND relrowsecurity) AS tabla_con_rls,
--   (SELECT count(*) FROM pg_policies WHERE tablename = 'company_price_tiers') AS politicas,
--   (SELECT count(*) FROM information_schema.columns WHERE table_name = 'company_customers' AND column_name = 'price_tier_id') AS tramo;
