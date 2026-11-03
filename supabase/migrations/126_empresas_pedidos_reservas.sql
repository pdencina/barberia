-- 126 · re-booking Empresas, Etapa 1: clientes comerciales, pedidos y stock reservado.
-- Aditiva y re-ejecutable. Requiere la 125. No toca tablas de salones.
-- Físico = quantity. Reservado = reserved_quantity. Disponible = físico - reservado.
-- Confirmar reserva, despachar descuenta el físico y la reserva, cancelar libera. Los cambios de estado solo pasan por funciones.
-- Candados siempre en orden (bodega, producto): así pedidos y traspasos simultáneos no se bloquean entre sí.

ALTER TABLE public.company_warehouse_stock ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE public.company_warehouse_stock DROP CONSTRAINT IF EXISTS company_warehouse_stock_reserved_check;
-- Sin tope contra quantity a propósito: un conteo físico puede dejar menos unidades que las reservadas, y eso debe verse como faltante.
ALTER TABLE public.company_warehouse_stock ADD CONSTRAINT company_warehouse_stock_reserved_check CHECK (reserved_quantity >= 0);

CREATE TABLE IF NOT EXISTS public.company_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  tax_id text CHECK (tax_id IS NULL OR char_length(tax_id) BETWEEN 1 AND 20),
  contact_name text,
  phone text,
  email text,
  address text,
  city text,
  customer_type text NOT NULL DEFAULT 'client' CHECK (customer_type IN ('client', 'distributor')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, tax_id)
);

CREATE TABLE IF NOT EXISTS public.company_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'prepared', 'dispatched', 'delivered', 'cancelled')),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_by uuid NOT NULL,        -- profiles.id, sin FK a propósito: el historial sobrevive al usuario
  confirmed_at timestamptz,
  prepared_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (customer_id, tenant_id) REFERENCES public.company_customers (id, tenant_id),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES public.company_warehouses (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS company_orders_tenant_status_idx ON public.company_orders (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS company_orders_customer_idx ON public.company_orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS company_orders_warehouse_fk_idx ON public.company_orders (warehouse_id, tenant_id);

CREATE TABLE IF NOT EXISTS public.company_order_items (
  order_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000000),
  unit_price numeric(14, 2) CHECK (unit_price IS NULL OR unit_price >= 0),   -- copia del precio al crear el pedido
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, product_id),
  FOREIGN KEY (order_id, tenant_id) REFERENCES public.company_orders (id, tenant_id),
  FOREIGN KEY (product_id, tenant_id) REFERENCES public.company_products (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS company_order_items_product_idx ON public.company_order_items (product_id, tenant_id);

ALTER TABLE public.company_stock_movements ADD COLUMN IF NOT EXISTS order_id uuid;
ALTER TABLE public.company_stock_movements DROP CONSTRAINT IF EXISTS company_stock_movements_order_fk;
ALTER TABLE public.company_stock_movements ADD CONSTRAINT company_stock_movements_order_fk
  FOREIGN KEY (order_id, tenant_id) REFERENCES public.company_orders (id, tenant_id);
CREATE INDEX IF NOT EXISTS company_stock_movements_order_idx ON public.company_stock_movements (order_id) WHERE order_id IS NOT NULL;
ALTER TABLE public.company_stock_movements DROP CONSTRAINT IF EXISTS company_stock_movements_movement_type_check;
ALTER TABLE public.company_stock_movements ADD CONSTRAINT company_stock_movements_movement_type_check
  CHECK (movement_type IN ('in', 'out', 'adjust', 'transfer_out', 'transfer_in', 'dispatch'));
ALTER TABLE public.company_stock_movements DROP CONSTRAINT IF EXISTS company_stock_movements_sign_check;
ALTER TABLE public.company_stock_movements ADD CONSTRAINT company_stock_movements_sign_check CHECK (
  (movement_type IN ('in', 'transfer_in') AND quantity_delta > 0)
  OR (movement_type IN ('out', 'transfer_out', 'dispatch') AND quantity_delta < 0)
  OR movement_type = 'adjust'
);

DROP TRIGGER IF EXISTS tr_company_customers_kind ON public.company_customers;
CREATE TRIGGER tr_company_customers_kind BEFORE INSERT OR UPDATE OF tenant_id ON public.company_customers
  FOR EACH ROW EXECUTE FUNCTION public.company_assert_tenant_kind();
DROP TRIGGER IF EXISTS tr_company_customers_updated_at ON public.company_customers;
CREATE TRIGGER tr_company_customers_updated_at BEFORE UPDATE ON public.company_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS tr_company_orders_updated_at ON public.company_orders;
CREATE TRIGGER tr_company_orders_updated_at BEFORE UPDATE ON public.company_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Un pedido solo se edita en borrador: si no, sus líneas dejarían de calzar con lo reservado.
CREATE OR REPLACE FUNCTION public.company_order_guard_header()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'order_not_editable' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tr_company_orders_guard ON public.company_orders;
CREATE TRIGGER tr_company_orders_guard BEFORE UPDATE OF customer_id, warehouse_id, tenant_id ON public.company_orders
  FOR EACH ROW EXECUTE FUNCTION public.company_order_guard_header();

CREATE OR REPLACE FUNCTION public.company_order_guard_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  -- FOR SHARE espera a una confirmación en curso: nadie cambia líneas mientras se reserva.
  SELECT status INTO v_status FROM public.company_orders
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.order_id ELSE NEW.order_id END FOR SHARE;
  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'order_not_editable' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tr_company_order_items_guard ON public.company_order_items;
CREATE TRIGGER tr_company_order_items_guard BEFORE INSERT OR UPDATE OR DELETE ON public.company_order_items
  FOR EACH ROW EXECUTE FUNCTION public.company_order_guard_items();

-- Igual que en la 125, con una regla nueva: salida y traspaso solo pueden usar lo disponible, no lo reservado.
-- El ajuste sí puede bajar de lo reservado: es la corrección de lo que hay físicamente.
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
        AND (v_step.movement_type NOT IN ('out', 'transfer_out')
             OR quantity::bigint - reserved_quantity + v_step.delta >= 0)
      RETURNING quantity INTO v_balance;
    IF NOT FOUND THEN
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

-- Bloquea el pedido y valida empresa, miembro y pertenencia. Los errores son códigos estables que la API traduce.
CREATE OR REPLACE FUNCTION public.company_order_lock(p_tenant_id uuid, p_order_id uuid, p_user_id uuid)
RETURNS public.company_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.company_orders;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id AND kind = 'company') THEN
    RAISE EXCEPTION 'tenant_not_company' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_members WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND active) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_order FROM public.company_orders WHERE id = p_order_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_order;
END;
$$;

-- Reserva todas las líneas o ninguna. Repetir la confirmación no reserva dos veces.
CREATE OR REPLACE FUNCTION public.company_order_confirm(p_tenant_id uuid, p_order_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.company_orders;
  v_item record;
BEGIN
  v_order := public.company_order_lock(p_tenant_id, p_order_id, p_user_id);
  IF v_order.status = 'confirmed' THEN
    RETURN jsonb_build_object('replayed', true, 'status', v_order.status);
  END IF;
  IF v_order.status <> 'draft' THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_order_items WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'order_empty' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_warehouses WHERE id = v_order.warehouse_id AND active) THEN
    RAISE EXCEPTION 'warehouse_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_order_items i JOIN public.company_products p ON p.id = i.product_id
             WHERE i.order_id = p_order_id AND NOT p.active) THEN
    RAISE EXCEPTION 'product_not_found' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT product_id, quantity FROM public.company_order_items WHERE order_id = p_order_id ORDER BY product_id LOOP
    INSERT INTO public.company_warehouse_stock (tenant_id, warehouse_id, product_id, quantity)
      VALUES (p_tenant_id, v_order.warehouse_id, v_item.product_id, 0)
      ON CONFLICT (warehouse_id, product_id) DO NOTHING;
    UPDATE public.company_warehouse_stock
      SET reserved_quantity = reserved_quantity + v_item.quantity, updated_at = now()
      WHERE warehouse_id = v_order.warehouse_id AND product_id = v_item.product_id
        AND quantity::bigint - reserved_quantity >= v_item.quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient_stock' USING ERRCODE = 'P0001', DETAIL = v_item.product_id::text;
    END IF;
  END LOOP;

  UPDATE public.company_orders SET status = 'confirmed', confirmed_at = now() WHERE id = p_order_id;
  RETURN jsonb_build_object('replayed', false, 'status', 'confirmed');
END;
$$;

-- p_to: 'prepared' (desde confirmed) o 'delivered' (desde dispatched). No mueve stock.
CREATE OR REPLACE FUNCTION public.company_order_advance(p_tenant_id uuid, p_order_id uuid, p_user_id uuid, p_to text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.company_orders;
BEGIN
  IF p_to IS NULL OR p_to NOT IN ('prepared', 'delivered') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;
  v_order := public.company_order_lock(p_tenant_id, p_order_id, p_user_id);
  IF v_order.status = p_to THEN
    RETURN jsonb_build_object('replayed', true, 'status', v_order.status);
  END IF;
  IF p_to = 'prepared' AND v_order.status = 'confirmed' THEN
    UPDATE public.company_orders SET status = 'prepared', prepared_at = now() WHERE id = p_order_id;
  ELSIF p_to = 'delivered' AND v_order.status = 'dispatched' THEN
    UPDATE public.company_orders SET status = 'delivered', delivered_at = now() WHERE id = p_order_id;
  ELSE
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('replayed', false, 'status', p_to);
END;
$$;

-- Descuenta físico y reserva, y anota la salida. Si un conteo dejó menos unidades que las reservadas, falla sin mover nada.
CREATE OR REPLACE FUNCTION public.company_order_dispatch(p_tenant_id uuid, p_order_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.company_orders;
  v_item record;
  v_balance integer;
BEGIN
  v_order := public.company_order_lock(p_tenant_id, p_order_id, p_user_id);
  IF v_order.status = 'dispatched' THEN
    RETURN jsonb_build_object('replayed', true, 'status', v_order.status);
  END IF;
  IF v_order.status <> 'prepared' THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT product_id, quantity FROM public.company_order_items WHERE order_id = p_order_id ORDER BY product_id LOOP
    UPDATE public.company_warehouse_stock
      SET quantity = quantity - v_item.quantity, reserved_quantity = reserved_quantity - v_item.quantity, updated_at = now()
      WHERE warehouse_id = v_order.warehouse_id AND product_id = v_item.product_id
        AND quantity >= v_item.quantity AND reserved_quantity >= v_item.quantity
      RETURNING quantity INTO v_balance;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient_stock' USING ERRCODE = 'P0001', DETAIL = v_item.product_id::text;
    END IF;
    INSERT INTO public.company_stock_movements
      (tenant_id, warehouse_id, product_id, movement_type, quantity_delta, balance_after, order_id, created_by)
      VALUES (p_tenant_id, v_order.warehouse_id, v_item.product_id, 'dispatch', -v_item.quantity, v_balance, p_order_id, p_user_id);
  END LOOP;

  UPDATE public.company_orders SET status = 'dispatched', dispatched_at = now() WHERE id = p_order_id;
  RETURN jsonb_build_object('replayed', false, 'status', 'dispatched');
END;
$$;

-- Cancela y libera la reserva. Lo ya despachado no se cancela: la devolución será otro flujo.
CREATE OR REPLACE FUNCTION public.company_order_cancel(p_tenant_id uuid, p_order_id uuid, p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.company_orders;
  v_item record;
BEGIN
  v_order := public.company_order_lock(p_tenant_id, p_order_id, p_user_id);
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('replayed', true, 'status', v_order.status);
  END IF;
  IF v_order.status NOT IN ('draft', 'confirmed', 'prepared') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;
  IF v_order.status <> 'draft' THEN
    FOR v_item IN SELECT product_id, quantity FROM public.company_order_items WHERE order_id = p_order_id ORDER BY product_id LOOP
      UPDATE public.company_warehouse_stock
        SET reserved_quantity = reserved_quantity - v_item.quantity, updated_at = now()
        WHERE warehouse_id = v_order.warehouse_id AND product_id = v_item.product_id;
    END LOOP;
  END IF;
  UPDATE public.company_orders SET status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason WHERE id = p_order_id;
  RETURN jsonb_build_object('replayed', false, 'status', 'cancelled');
END;
$$;

ALTER TABLE public.company_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_order_items ENABLE ROW LEVEL SECURITY;

-- El servidor crea y edita borradores, pero el estado y las fechas solo cambian por las funciones.
REVOKE ALL ON public.company_customers, public.company_orders, public.company_order_items FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_customers, public.company_order_items TO service_role;
GRANT SELECT ON public.company_orders TO service_role;
GRANT INSERT (tenant_id, customer_id, warehouse_id, notes, created_by) ON public.company_orders TO service_role;
GRANT UPDATE (customer_id, warehouse_id, notes) ON public.company_orders TO service_role;

REVOKE ALL ON FUNCTION public.company_order_lock(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.company_order_guard_header() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_order_guard_items() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_order_confirm(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_order_advance(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_order_dispatch(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_order_cancel(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_order_confirm(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_order_advance(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_order_dispatch(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_order_cancel(uuid, uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';

-- Verificación (debe devolver: 3 tablas con RLS, 0 políticas, 4 funciones públicas, 0 reservas sin pedido):
-- SELECT
--   (SELECT count(*) FROM pg_class WHERE relname IN ('company_customers','company_orders','company_order_items') AND relrowsecurity) AS tablas_con_rls,
--   (SELECT count(*) FROM pg_policies WHERE tablename IN ('company_customers','company_orders','company_order_items')) AS politicas,
--   (SELECT count(*) FROM pg_proc WHERE proname IN ('company_order_confirm','company_order_advance','company_order_dispatch','company_order_cancel')) AS funciones,
--   (SELECT count(*) FROM public.company_warehouse_stock s WHERE s.reserved_quantity <> coalesce((
--       SELECT sum(i.quantity) FROM public.company_order_items i JOIN public.company_orders o ON o.id = i.order_id
--       WHERE o.warehouse_id = s.warehouse_id AND i.product_id = s.product_id AND o.status IN ('confirmed', 'prepared')), 0)) AS reservas_sin_pedido;
