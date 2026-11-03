-- 127 · re-booking Empresas, Etapa 1: toma de inventario (conteo físico por bodega). Es lo primero que pidió Felipe.
-- Aditiva y re-ejecutable. Requiere la 125 y la 126. No toca tablas de salones.
-- Cada línea guarda lo que decía el sistema al contar. Al cerrar se aplica solo la diferencia (contado - sistema),
-- así lo que se vendió o entró durante el conteo no se pisa. Lo no contado queda igual.
-- La pantalla no debe mostrarle system_quantity a quien cuenta: un conteo a ciegas evita copiar el número del sistema.

CREATE TABLE IF NOT EXISTS public.company_inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by uuid NOT NULL,
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES public.company_warehouses (id, tenant_id)
);
-- Un solo conteo abierto por bodega.
CREATE UNIQUE INDEX IF NOT EXISTS company_inventory_counts_open_idx ON public.company_inventory_counts (warehouse_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS company_inventory_counts_tenant_idx ON public.company_inventory_counts (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS company_inventory_counts_warehouse_fk_idx ON public.company_inventory_counts (warehouse_id, tenant_id);

CREATE TABLE IF NOT EXISTS public.company_inventory_count_lines (
  count_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  system_quantity integer NOT NULL CHECK (system_quantity >= 0),
  counted_quantity integer NOT NULL CHECK (counted_quantity BETWEEN 0 AND 2000000000),
  counted_by uuid NOT NULL,
  counted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (count_id, product_id),
  FOREIGN KEY (count_id, tenant_id) REFERENCES public.company_inventory_counts (id, tenant_id),
  FOREIGN KEY (product_id, tenant_id) REFERENCES public.company_products (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS company_inventory_count_lines_product_idx ON public.company_inventory_count_lines (product_id, tenant_id);

ALTER TABLE public.company_stock_movements ADD COLUMN IF NOT EXISTS count_id uuid;
ALTER TABLE public.company_stock_movements DROP CONSTRAINT IF EXISTS company_stock_movements_count_fk;
ALTER TABLE public.company_stock_movements ADD CONSTRAINT company_stock_movements_count_fk
  FOREIGN KEY (count_id, tenant_id) REFERENCES public.company_inventory_counts (id, tenant_id);
CREATE INDEX IF NOT EXISTS company_stock_movements_count_idx ON public.company_stock_movements (count_id) WHERE count_id IS NOT NULL;
ALTER TABLE public.company_stock_movements DROP CONSTRAINT IF EXISTS company_stock_movements_movement_type_check;
ALTER TABLE public.company_stock_movements ADD CONSTRAINT company_stock_movements_movement_type_check
  CHECK (movement_type IN ('in', 'out', 'adjust', 'transfer_out', 'transfer_in', 'dispatch', 'count'));
ALTER TABLE public.company_stock_movements DROP CONSTRAINT IF EXISTS company_stock_movements_sign_check;
ALTER TABLE public.company_stock_movements ADD CONSTRAINT company_stock_movements_sign_check CHECK (
  (movement_type IN ('in', 'transfer_in') AND quantity_delta > 0)
  OR (movement_type IN ('out', 'transfer_out', 'dispatch') AND quantity_delta < 0)
  OR movement_type IN ('adjust', 'count')
);

CREATE OR REPLACE FUNCTION public.company_count_open(p_tenant_id uuid, p_warehouse_id uuid, p_user_id uuid, p_notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id AND kind = 'company') THEN
    RAISE EXCEPTION 'tenant_not_company' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_members WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND active) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_warehouses WHERE id = p_warehouse_id AND tenant_id = p_tenant_id AND active) THEN
    RAISE EXCEPTION 'warehouse_not_found' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.company_inventory_counts (tenant_id, warehouse_id, notes, created_by)
    VALUES (p_tenant_id, p_warehouse_id, p_notes, p_user_id)
    RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'count_already_open' USING ERRCODE = 'P0001';
END;
$$;

-- Bloquea el conteo y valida empresa, miembro y pertenencia.
CREATE OR REPLACE FUNCTION public.company_count_lock(p_tenant_id uuid, p_count_id uuid, p_user_id uuid)
RETURNS public.company_inventory_counts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count public.company_inventory_counts;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id AND kind = 'company') THEN
    RAISE EXCEPTION 'tenant_not_company' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_members WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND active) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_count FROM public.company_inventory_counts WHERE id = p_count_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'count_not_found' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_count;
END;
$$;

-- Anota lo contado. Contar de nuevo el mismo producto reemplaza la línea, con el saldo del sistema de ese momento.
CREATE OR REPLACE FUNCTION public.company_count_record(p_tenant_id uuid, p_count_id uuid, p_product_id uuid, p_counted integer, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count public.company_inventory_counts;
  v_system integer;
BEGIN
  IF p_counted IS NULL OR p_counted < 0 OR p_counted > 2000000000 THEN
    RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = 'P0001';
  END IF;
  v_count := public.company_count_lock(p_tenant_id, p_count_id, p_user_id);
  IF v_count.status <> 'open' THEN
    RAISE EXCEPTION 'count_not_open' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_products WHERE id = p_product_id AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'product_not_found' USING ERRCODE = 'P0001';
  END IF;
  SELECT quantity INTO v_system FROM public.company_warehouse_stock
    WHERE warehouse_id = v_count.warehouse_id AND product_id = p_product_id;
  INSERT INTO public.company_inventory_count_lines (count_id, tenant_id, product_id, system_quantity, counted_quantity, counted_by)
    VALUES (p_count_id, p_tenant_id, p_product_id, coalesce(v_system, 0), p_counted, p_user_id)
    ON CONFLICT (count_id, product_id) DO UPDATE
      SET system_quantity = EXCLUDED.system_quantity, counted_quantity = EXCLUDED.counted_quantity,
          counted_by = EXCLUDED.counted_by, counted_at = now();
END;
$$;

-- Aplica todas las diferencias o ninguna. Si lo movido durante el conteo deja un saldo negativo, pide contar de nuevo ese producto.
CREATE OR REPLACE FUNCTION public.company_count_close(p_tenant_id uuid, p_count_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count public.company_inventory_counts;
  v_line record;
  v_delta integer;
  v_balance integer;
  v_changed integer := 0;
BEGIN
  v_count := public.company_count_lock(p_tenant_id, p_count_id, p_user_id);
  IF v_count.status = 'closed' THEN
    RETURN jsonb_build_object('replayed', true, 'status', v_count.status);
  END IF;
  IF v_count.status <> 'open' THEN
    RAISE EXCEPTION 'count_not_open' USING ERRCODE = 'P0001';
  END IF;

  FOR v_line IN SELECT product_id, system_quantity, counted_quantity FROM public.company_inventory_count_lines
                WHERE count_id = p_count_id ORDER BY product_id LOOP
    v_delta := v_line.counted_quantity - v_line.system_quantity;
    CONTINUE WHEN v_delta = 0;
    INSERT INTO public.company_warehouse_stock (tenant_id, warehouse_id, product_id, quantity)
      VALUES (p_tenant_id, v_count.warehouse_id, v_line.product_id, 0)
      ON CONFLICT (warehouse_id, product_id) DO NOTHING;
    UPDATE public.company_warehouse_stock
      SET quantity = (quantity::bigint + v_delta)::integer, updated_at = now()
      WHERE warehouse_id = v_count.warehouse_id AND product_id = v_line.product_id
        AND quantity::bigint + v_delta BETWEEN 0 AND 2000000000
      RETURNING quantity INTO v_balance;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'count_conflict' USING ERRCODE = 'P0001', DETAIL = v_line.product_id::text;
    END IF;
    INSERT INTO public.company_stock_movements
      (tenant_id, warehouse_id, product_id, movement_type, quantity_delta, balance_after, count_id, reason, created_by)
      VALUES (p_tenant_id, v_count.warehouse_id, v_line.product_id, 'count', v_delta, v_balance, p_count_id, 'Toma de inventario', p_user_id);
    v_changed := v_changed + 1;
  END LOOP;

  UPDATE public.company_inventory_counts SET status = 'closed', closed_by = p_user_id, closed_at = now() WHERE id = p_count_id;
  RETURN jsonb_build_object('replayed', false, 'status', 'closed', 'products_changed', v_changed);
END;
$$;

CREATE OR REPLACE FUNCTION public.company_count_cancel(p_tenant_id uuid, p_count_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count public.company_inventory_counts;
BEGIN
  v_count := public.company_count_lock(p_tenant_id, p_count_id, p_user_id);
  IF v_count.status = 'cancelled' THEN
    RETURN jsonb_build_object('replayed', true, 'status', v_count.status);
  END IF;
  IF v_count.status <> 'open' THEN
    RAISE EXCEPTION 'count_not_open' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.company_inventory_counts SET status = 'cancelled', closed_by = p_user_id, closed_at = now() WHERE id = p_count_id;
  RETURN jsonb_build_object('replayed', false, 'status', 'cancelled');
END;
$$;

ALTER TABLE public.company_inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_inventory_count_lines ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.company_inventory_counts, public.company_inventory_count_lines FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.company_inventory_counts, public.company_inventory_count_lines TO service_role;

REVOKE ALL ON FUNCTION public.company_count_lock(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.company_count_open(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_count_record(uuid, uuid, uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_count_close(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_count_cancel(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_count_open(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_count_record(uuid, uuid, uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_count_close(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_count_cancel(uuid, uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

-- Verificación (debe devolver: 2 tablas con RLS, 0 políticas, 4 funciones públicas):
-- SELECT
--   (SELECT count(*) FROM pg_class WHERE relname IN ('company_inventory_counts','company_inventory_count_lines') AND relrowsecurity) AS tablas_con_rls,
--   (SELECT count(*) FROM pg_policies WHERE tablename IN ('company_inventory_counts','company_inventory_count_lines')) AS politicas,
--   (SELECT count(*) FROM pg_proc WHERE proname IN ('company_count_open','company_count_record','company_count_close','company_count_cancel')) AS funciones;
