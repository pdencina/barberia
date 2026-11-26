import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, primerNombre, demasiadosIntentos, ipDe, moduloDe } from "@/lib/totem";
import { citasParaCobro, citasDeOtrasPersonas } from "@/lib/totem-citas";
import { armarItemsProductos } from "@/lib/totem-producto";
import { notify } from "@/lib/notify";

// POST {codigo, appointmentId(s), code, productos?, otros?}: el cliente quiere pagar en EFECTIVO. Solo crea el pedido: la venta se registra cuando
// el profesional confirma en su celular que recibió el dinero. Apagado por defecto (Configuración > Tótem). Montos siempre del servidor.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`pagoefe:${ipDe(req)}`, 8)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(supabase, body.codigo);
  if (!t) return NextResponse.json({ error: "Tótem no disponible" }, { status: 404 });
  const { data: cfg } = await supabase.from("tenants").select("kiosk_cash_enabled").eq("id", t.id).maybeSingle();
  if (!(cfg as any)?.kiosk_cash_enabled) return NextResponse.json({ error: "El pago en efectivo no está activado en este local." }, { status: 403 });

  const cc = await citasParaCobro(supabase, t.id, body.code, Array.isArray(body.appointmentIds) ? body.appointmentIds : [body.appointmentId]);
  if (!cc.ok) return NextResponse.json({ error: cc.error }, { status: cc.status });
  let items: any[] | null = null;
  let extraTotal = 0;
  if (Array.isArray(body.productos) && body.productos.length) {
    const c = await armarItemsProductos(supabase, t.id, body.productos, true);
    if (!c.ok) return NextResponse.json({ error: c.error }, { status: c.status });
    items = c.items; extraTotal = c.total;
  }
  const otras = await citasDeOtrasPersonas(supabase, t.id, cc, body.otros);
  if (!otras.ok) return NextResponse.json({ error: otras.error }, { status: otras.status });
  const monto = cc.saldo + otras.saldo + extraTotal;
  const extraIds = [...cc.extraIds, ...otras.extraIds];

  // Un pedido en efectivo anterior de esta misma cita (el cliente reintentó) se reemplaza.
  await supabase.from("kiosk_payments").update({ status: "cancelled" }).eq("tenant_id", t.id).eq("appointment_id", cc.primeraId).eq("method", "cash").eq("status", "pending");
  const modulo = moduloDe(req);
  const { data: kp, error } = await supabase.from("kiosk_payments").insert({
    tenant_id: t.id, appointment_id: cc.primeraId, ...(extraIds.length ? { appointment_ids: extraIds } : {}), ...(items ? { items } : {}), ...(modulo > 0 ? { module: modulo } : {}),
    amount: monto, method: "cash",
  }).select("id").single();
  if (error || !kp) return NextResponse.json({ error: "No pudimos crear el pago. Avisa a quien te atiende." }, { status: 500 });

  const { data: ap } = await supabase.from("appointments").select("client:clients(name), barber:profiles!barber_id(name)").eq("id", cc.primeraId).maybeSingle();
  const profesional = (ap as any)?.barber?.name || null;
  await notify({
    tenantId: t.id, kind: "kiosk_payment", userIds: [cc.barberId], roles: ["admin"], professionalId: cc.barberId,
    title: "Pago en efectivo: confirma el dinero",
    body: `${primerNombre((ap as any)?.client?.name) || "Un cliente"} va a pagar $${monto.toLocaleString("es-CL")} en efectivo${profesional ? ` a ${profesional}` : ""}. Toca para confirmar.`,
    url: "/dashboard/standby",
  }).catch(() => {});
  return NextResponse.json({ ok: true, id: (kp as any).id, monto, profesional });
}
