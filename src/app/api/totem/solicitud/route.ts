import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, normalizarCodigo, hoyChile, primerNombre, demasiadosIntentos, ipDe } from "@/lib/totem";
import { notify } from "@/lib/notify";

// POST {slug, tipo: "pago"|"producto", code?, productos?: [{id, cantidad}]}: el cliente pide pagar o llevarse un producto.
// El totem NO cobra todavia: avisa al equipo para que lo cobre (mismo POS de siempre). Los precios los toma el servidor.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`solicitud:${ipDe(req)}`, 10)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(supabase, body.slug);
  if (!t) return NextResponse.json({ error: "Totem no disponible" }, { status: 404 });

  let quien = "Un cliente";
  let barberId: string | null = null;
  const code = normalizarCodigo(body.code);
  if (code.length === 5) {
    const { data: a } = await supabase.from("appointments").select("barber_id, client:clients(name)").eq("tenant_id", t.id).eq("date", hoyChile()).eq("checkin_code", code).maybeSingle();
    if (a) { quien = primerNombre((a as any).client?.name) || quien; barberId = (a as any).barber_id || null; }
  }

  if (body.tipo === "pago") {
    await notify({ tenantId: t.id, kind: "client_arrived", roles: ["admin", "receptionist"], userIds: barberId ? [barberId] : [], title: "Cliente quiere pagar", body: `${quien} pidió pagar desde el tótem.`, url: "/dashboard/pos", professionalId: barberId }).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  if (body.tipo === "producto") {
    const pedidos: Array<{ id: string; cantidad: number }> = (Array.isArray(body.productos) ? body.productos : []).slice(0, 10).map((p: any) => ({ id: String(p?.id || ""), cantidad: Math.max(1, Math.min(10, Math.floor(Number(p?.cantidad) || 1))) }));
    if (pedidos.length === 0) return NextResponse.json({ error: "Elige un producto" }, { status: 400 });
    const { data: prods } = await supabase.from("products").select("id, name, price").eq("tenant_id", t.id).eq("active", true).in("id", pedidos.map((p) => p.id));
    const mapa = new Map((prods || []).map((p: any) => [p.id, p]));
    const lineas = pedidos.filter((p) => mapa.has(p.id)).map((p) => `${p.cantidad} x ${(mapa.get(p.id) as any).name}`);
    if (lineas.length === 0) return NextResponse.json({ error: "Producto no disponible" }, { status: 400 });
    const total = pedidos.reduce((s, p) => s + (mapa.has(p.id) ? Number((mapa.get(p.id) as any).price) * p.cantidad : 0), 0);
    await notify({ tenantId: t.id, kind: "client_arrived", roles: ["admin", "receptionist"], title: "Producto pedido en el tótem", body: `${quien} quiere: ${lineas.join(", ")} ($${total.toLocaleString("es-CL")}). Cóbraselo en el POS.`, url: "/dashboard/pos" }).catch(() => {});
    return NextResponse.json({ ok: true, total });
  }
  return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
}
