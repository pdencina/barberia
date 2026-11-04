import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, isManagerLevel } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminSupabase();
  // SEGURIDAD: antes no pedia sesion: cualquiera podia editar precios y stock de cualquier producto, y mover el producto de negocio. Solo la gestion del negocio dueno del producto.
  const me = await isManagerLevel();
  if (!me.userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!me.ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { data: owned } = await supabase.from("products").select("tenant_id").eq("id", params.id).maybeSingle();
  if (!owned || (me.role !== "super_admin" && (!me.tenantId || (owned as any).tenant_id !== me.tenantId))) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  // El navegador manda tenantId (solo sirve al crear); no es columna de products y hacia fallar todo el guardado.
  // Tampoco se permite cambiar la identidad ni el negocio del producto desde aqui.
  const { tenantId: _ignored, id: _id, tenant_id: _tid, created_at: _ca, ...body } = await req.json();

  // If price is being changed, log it
  if (body.price !== undefined) {
    const { data: current } = await supabase
      .from("products")
      .select("name, price")
      .eq("id", params.id)
      .single();

    if (current && Number(current.price) !== Number(body.price)) {
      await supabase.from("price_history").insert({
        entity_type: "product",
        entity_id: params.id,
        entity_name: current.name,
        old_price: Number(current.price),
        new_price: Number(body.price),
      });
    }
  }

  let { data, error } = await supabase
    .from("products")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  // Columnas nuevas (comision por venta: migracion 091; tipo y categoria: 092): si aun no existen, no se pierde el
  // resto de los cambios.
  if (error && /sales_commission|product_type|category/.test(error.message)) {
    const { sales_commission_type: _t, sales_commission_value: _v, product_type: _p, category: _c, ...rest } = body;
    ({ data, error } = await supabase.from("products").update(rest).eq("id", params.id).select().single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
