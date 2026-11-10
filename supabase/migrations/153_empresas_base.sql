-- 153 (antes 125) · re-booking Empresas, Etapa 1 (base): tipo de negocio, miembros, bodegas, catálogo y stock por bodega.
-- Aditiva y re-ejecutable. No cambia nada de los salones: tenants.kind = 'salon' por defecto y ninguna tabla de salón se toca.
-- NO agrega valores a profiles.role (ALTER TYPE no se revierte fácil); eso se decide cuando se construya el login de empresa.
-- Catálogo en tabla propia y no en products: products.sku es único en toda la base y products tiene política abierta a authenticated.
-- Todas las tablas: tenant_id + RLS sin políticas (solo servidor).
-- Stock y movimientos: la API solo puede LEERLOS; la única forma de escribir es la función atómica company_stock_move.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'salon';
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_kind_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_kind_check CHECK (kind IN ('salon', 'company'));

-- tenants tiene una política abierta a authenticated: sin esto, una sesión del navegador podría cambiar kind.
-- Solo corre si se escribe kind, así que los salones siguen igual.
CREATE OR REPLACE FUNCTION public.tenants_protect_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin')
     AND (TG_OP = 'INSERT' AND NEW.kind <> 'salon' OR TG_OP = 'UPDATE' AND NEW.kind IS DISTINCT FROM OLD.kind) THEN
    RAISE EXCEPTION 'kind_protected' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tr_tenants_protect_kind ON public.tenants;
CREATE TRIGGER tr_tenants_protect_kind BEFORE INSERT OR UPDATE OF kind ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.tenants_protect_kind();

CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_key text NOT NULL CHECK (role_key IN ('owner', 'seller', 'warehouse')),   -- los 3 roles de la Etapa 1; las capacidades se definen en el servidor
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS company_members_user_idx ON public.company_members (user_id);

CREATE TABLE IF NOT EXISTS public.company_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.company_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  sku text CHECK (sku IS NULL OR char_length(sku) BETWEEN 1 AND 80),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description text,
  category text,
  unit text NOT NULL DEFAULT 'unidad',
  list_price numeric(14, 2) CHECK (list_price IS NULL OR list_price >= 0),
  cost numeric(14, 2) CHECK (cost IS NULL OR cost >= 0),
  min_stock integer NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, sku)
);

-- Las FK compuestas impiden que una fila mezcle la bodega o el producto de otra empresa.
CREATE TABLE IF NOT EXISTS public.company_warehouse_stock (
  tenant_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity BETWEEN 0 AND 2000000000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (warehouse_id, product_id),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES public.company_warehouses (id, tenant_id),
  FOREIGN KEY (product_id, tenant_id) REFERENCES public.company_products (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS company_warehouse_stock_product_idx ON public.company_warehouse_stock (tenant_id, product_id);

CREATE TABLE IF NOT EXISTS public.company_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  product_id uuid NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('in', 'out', 'adjust', 'transfer_out', 'transfer_in')),
  quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  transfer_id uuid,                -- une las dos filas de un traspaso
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  idempotency_key text CHECK (idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 1 AND 100),
  created_by uuid NOT NULL,        -- profiles.id, sin FK a propósito (igual que transactions.created_by): el historial sobrevive al usuario
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES public.company_warehouses (id, tenant_id),
  FOREIGN KEY (product_id, tenant_id) REFERENCES public.company_products (id, tenant_id),
  CONSTRAINT company_stock_movements_sign_check CHECK (
    (movement_type IN ('in', 'transfer_in') AND quantity_delta > 0)
    OR (movement_type IN ('out', 'transfer_out') AND quantity_delta < 0)
    OR movement_type = 'adjust'
  ),
  CONSTRAINT company_stock_movements_transfer_check CHECK (
    (movement_type IN ('transfer_in', 'transfer_out')) = (transfer_id IS NOT NULL)
  ),
  CONSTRAINT company_stock_movements_adjust_reason_check CHECK (movement_type <> 'adjust' OR reason IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS company_stock_movements_tenant_idx ON public.company_stock_movements (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS company_stock_movements_product_idx ON public.company_stock_movements (product_id, warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS company_stock_movements_warehouse_fk_idx ON public.company_stock_movements (warehouse_id, tenant_id);
-- warehouse_id en la llave porque un traspaso anota dos filas con la misma llave.
CREATE UNIQUE INDEX IF NOT EXISTS company_stock_movements_idempotency_idx
  ON public.company_stock_movements (tenant_id, idempotency_key, warehouse_id) WHERE idempotency_key IS NOT NULL;

-- Estas tablas solo admiten negocios tipo empresa: un salón nunca puede recibir filas por error.
CREATE OR REPLACE FUNCTION public.company_assert_tenant_kind()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = NEW.tenant_id AND kind = 'company') THEN
    RAISE EXCEPTION 'tenant_not_company' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_company_members_kind ON public.company_members;
CREATE TRIGGER tr_company_members_kind BEFORE INSERT OR UPDATE OF tenant_id ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.company_assert_tenant_kind();
DROP TRIGGER IF EXISTS tr_company_warehouses_kind ON public.company_warehouses;
CREATE TRIGGER tr_company_warehouses_kind BEFORE INSERT OR UPDATE OF tenant_id ON public.company_warehouses
  FOR EACH ROW EXECUTE FUNCTION public.company_assert_tenant_kind();
DROP TRIGGER IF EXISTS tr_company_products_kind ON public.company_products;
CREATE TRIGGER tr_company_products_kind BEFORE INSERT OR UPDATE OF tenant_id ON public.company_products
  FOR EACH ROW EXECUTE FUNCTION public.company_assert_tenant_kind();

DROP TRIGGER IF EXISTS tr_company_members_updated_at ON public.company_members;
CREATE TRIGGER tr_company_members_updated_at BEFORE UPDATE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS tr_company_warehouses_updated_at ON public.company_warehouses;
CREATE TRIGGER tr_company_warehouses_updated_at BEFORE UPDATE ON public.company_warehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS tr_company_products_updated_at ON public.company_products;
CREATE TRIGGER tr_company_products_updated_at BEFORE UPDATE ON public.company_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Único punto de escritura de stock. p_type: in | out | adjust | transfer.
-- p_quantity: positiva; en adjust es la diferencia con signo (nunca el total, para no pisar a otro movimiento).
-- Errores: el mensaje es un código estable que la API traduce (insufficient_stock, invalid_quantity, etc.).
-- La capacidad del usuario (quién puede mover stock) la valida la ruta; aquí solo se exige que sea miembro activo.
CREATE OR REPLACE FUNCTION public.company_stock_move(
  p_tenant_id uuid,
  p_type text,
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity integer,
  p_created_by uuid,
  p_to_warehouse_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_transfer_id uuid;
  v_locks uuid[];
  v_wh uuid;
  v_balance integer;
  v_movements jsonb := '[]'::jsonb;
  v_row public.company_stock_movements;
  v_step record;
  v_same boolean;
BEGIN
  IF p_type IS NULL OR p_type NOT IN ('in', 'out', 'adjust', 'transfer') THEN
    RAISE EXCEPTION 'invalid_type' USING ERRCODE = 'P0001';
  END IF;
  IF p_quantity IS NULL OR p_quantity = 0 OR abs(p_quantity::bigint) > 1000000000
     OR (p_type <> 'adjust' AND p_quantity < 0) THEN
    RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = 'P0001';
  END IF;
  IF p_type = 'adjust' AND nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_type = 'transfer' AND (p_to_warehouse_id IS NULL OR p_to_warehouse_id = p_warehouse_id) THEN
    RAISE EXCEPTION 'invalid_transfer' USING ERRCODE = 'P0001';
  END IF;
  IF p_type <> 'transfer' AND p_to_warehouse_id IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_transfer' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id AND kind = 'company') THEN
    RAISE EXCEPTION 'tenant_not_company' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_members WHERE tenant_id = p_tenant_id AND user_id = p_created_by AND active) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_products WHERE id = p_product_id AND tenant_id = p_tenant_id AND active) THEN
    RAISE EXCEPTION 'product_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.company_warehouses
      WHERE tenant_id = p_tenant_id AND active AND id IN (p_warehouse_id, p_to_warehouse_id))
     <> (CASE WHEN p_type = 'transfer' THEN 2 ELSE 1 END) THEN
    RAISE EXCEPTION 'warehouse_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Reintento: la misma llave devuelve lo ya hecho, sin mover stock otra vez. El candado evita que dos reintentos simultáneos pasen juntos.
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant_id::text || ':' || p_idempotency_key, 0));
    SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.quantity_delta), '[]'::jsonb) INTO v_movements
      FROM public.company_stock_movements m
      WHERE m.tenant_id = p_tenant_id AND m.idempotency_key = p_idempotency_key;
    IF jsonb_array_length(v_movements) > 0 THEN
      SELECT bool_and(
               m.product_id = p_product_id
               AND CASE p_type
                 WHEN 'transfer' THEN m.movement_type IN ('transfer_in', 'transfer_out')
                   AND abs(m.quantity_delta) = p_quantity
                   AND m.warehouse_id = CASE WHEN m.quantity_delta < 0 THEN p_warehouse_id ELSE p_to_warehouse_id END
                 WHEN 'adjust' THEN m.movement_type = 'adjust' AND m.quantity_delta = p_quantity AND m.warehouse_id = p_warehouse_id
                 ELSE m.movement_type = p_type AND abs(m.quantity_delta) = p_quantity AND m.warehouse_id = p_warehouse_id
               END
             ) INTO v_same
        FROM public.company_stock_movements m
        WHERE m.tenant_id = p_tenant_id AND m.idempotency_key = p_idempotency_key;
      IF NOT v_same THEN
        RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = 'P0001';
      END IF;
      RETURN jsonb_build_object('replayed', true, 'movements', v_movements);
    END IF;
  END IF;

  -- Candados siempre en el mismo orden de bodega: dos traspasos opuestos (A→B y B→A) no se bloquean entre sí.
  IF p_type = 'transfer' THEN
    v_transfer_id := gen_random_uuid();
    v_locks := CASE WHEN p_warehouse_id < p_to_warehouse_id
      THEN ARRAY[p_warehouse_id, p_to_warehouse_id] ELSE ARRAY[p_to_warehouse_id, p_warehouse_id] END;
  ELSE
    v_locks := ARRAY[p_warehouse_id];
  END IF;
  FOREACH v_wh IN ARRAY v_locks LOOP
    INSERT INTO public.company_warehouse_stock (tenant_id, warehouse_id, product_id, quantity)
      VALUES (p_tenant_id, v_wh, p_product_id, 0)
      ON CONFLICT (warehouse_id, product_id) DO NOTHING;
    PERFORM 1 FROM public.company_warehouse_stock
      WHERE warehouse_id = v_wh AND product_id = p_product_id FOR UPDATE;
  END LOOP;

  FOR v_step IN
    SELECT * FROM (VALUES
      (p_warehouse_id,
       CASE p_type WHEN 'in' THEN p_quantity WHEN 'adjust' THEN p_quantity ELSE -p_quantity END,
       CASE p_type WHEN 'transfer' THEN 'transfer_out' ELSE p_type END),
      (p_to_warehouse_id, p_quantity, 'transfer_in')
    ) AS s(warehouse_id, delta, movement_type)
    WHERE s.warehouse_id IS NOT NULL
  LOOP
    UPDATE public.company_warehouse_stock
      SET quantity = (quantity::bigint + v_step.delta)::integer, updated_at = now()
      WHERE warehouse_id = v_step.warehouse_id AND product_id = p_product_id
        AND quantity::bigint + v_step.delta BETWEEN 0 AND 2000000000
      RETURNING quantity INTO v_balance;
    IF NOT FOUND THEN
      -- La excepción deshace toda la operación, incluida la fila en cero y la otra pata del traspaso.
      RAISE EXCEPTION '%', CASE WHEN v_step.delta < 0 THEN 'insufficient_stock' ELSE 'quantity_out_of_range' END USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.company_stock_movements
      (tenant_id, warehouse_id, product_id, movement_type, quantity_delta, balance_after, transfer_id, reason, idempotency_key, created_by)
      VALUES (p_tenant_id, v_step.warehouse_id, p_product_id, v_step.movement_type, v_step.delta, v_balance, v_transfer_id, p_reason, p_idempotency_key, p_created_by)
      RETURNING * INTO v_row;
    v_movements := v_movements || to_jsonb(v_row);
  END LOOP;

  RETURN jsonb_build_object('replayed', false, 'movements', v_movements);
END;
$$;

-- Permisos: el navegador no entra a nada. El servidor administra catálogo, bodegas y miembros, pero stock y movimientos solo los lee.
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_stock_movements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.company_members, public.company_warehouses, public.company_products,
  public.company_warehouse_stock, public.company_stock_movements FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members, public.company_warehouses, public.company_products TO service_role;
GRANT SELECT ON public.company_warehouse_stock, public.company_stock_movements TO service_role;

REVOKE ALL ON FUNCTION public.company_stock_move(uuid, text, uuid, uuid, integer, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_stock_move(uuid, text, uuid, uuid, integer, uuid, uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.company_assert_tenant_kind() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tenants_protect_kind() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenants_protect_kind() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Verificación (debe devolver: salones = total de negocios antes de crear empresas, 5 tablas con RLS, 0 políticas, 1 función):
-- SELECT
--   (SELECT count(*) FROM public.tenants WHERE kind = 'salon') AS salones,
--   (SELECT count(*) FROM pg_class WHERE relname LIKE 'company\_%' AND relkind = 'r' AND relrowsecurity) AS tablas_con_rls,
--   (SELECT count(*) FROM pg_policies WHERE tablename LIKE 'company\_%') AS politicas,
--   (SELECT count(*) FROM pg_proc WHERE proname = 'company_stock_move') AS funcion;
