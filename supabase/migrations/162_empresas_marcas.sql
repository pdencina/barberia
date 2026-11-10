-- 162 · re-booking Empresas: marcas (Felipe maneja varias: Nishman, Pro Rapid, Viggo, Starke, Kings Armours, Rovra...).
-- Aditiva y re-ejecutable. Requiere la 153. No toca tablas de salones.
-- Cada producto puede pertenecer a una marca; el dashboard del dueño muestra ventas, margen y stock por marca.

CREATE TABLE IF NOT EXISTS public.company_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  color text NOT NULL DEFAULT '#0A6E6B' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS company_brands_tenant_idx ON public.company_brands (tenant_id, sort);

DROP TRIGGER IF EXISTS tr_company_brands_kind ON public.company_brands;
CREATE TRIGGER tr_company_brands_kind BEFORE INSERT OR UPDATE OF tenant_id ON public.company_brands
  FOR EACH ROW EXECUTE FUNCTION public.company_assert_tenant_kind();
DROP TRIGGER IF EXISTS tr_company_brands_updated_at ON public.company_brands;
CREATE TRIGGER tr_company_brands_updated_at BEFORE UPDATE ON public.company_brands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Marca del producto. La FK compuesta impide usar la marca de otra empresa.
ALTER TABLE public.company_products ADD COLUMN IF NOT EXISTS brand_id uuid;
ALTER TABLE public.company_products DROP CONSTRAINT IF EXISTS company_products_brand_fk;
ALTER TABLE public.company_products ADD CONSTRAINT company_products_brand_fk
  FOREIGN KEY (brand_id, tenant_id) REFERENCES public.company_brands (id, tenant_id);
CREATE INDEX IF NOT EXISTS company_products_brand_idx ON public.company_products (tenant_id, brand_id);

ALTER TABLE public.company_brands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_brands FROM PUBLIC, anon, authenticated, service_role;
-- Las marcas no se borran (los productos las referencian): se desactivan.
GRANT SELECT, INSERT, UPDATE ON public.company_brands TO service_role;

NOTIFY pgrst, 'reload schema';

-- Verificación (debe devolver: 1 tabla con RLS, 0 políticas, 1 columna de marca):
-- SELECT
--   (SELECT count(*) FROM pg_class WHERE relname = 'company_brands' AND relrowsecurity) AS tabla_con_rls,
--   (SELECT count(*) FROM pg_policies WHERE tablename = 'company_brands') AS politicas,
--   (SELECT count(*) FROM information_schema.columns WHERE table_name = 'company_products' AND column_name = 'brand_id') AS marca;
