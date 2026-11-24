import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, normalizarCodigo, soloDiaDelTotem, primerNombre, demasiadosIntentos, ipDe, moduloDe } from "@/lib/totem";
import { citasParaCobro, citasDeOtrasPersonas } from "@/lib/totem-citas";
import { armarItemsProductos } from "@/lib/totem-producto";
import { resolverTerminal, iniciarCobro, cancelarCobro } from "@/lib/totem-terminal";
import { notify } from "@/lib/notify";

// POST {codigo, appointmentId, code, tarjeta?: "debito"|"credito"}: manda el cobro del saldo de la cita a la MÁQUINA de tarjetas
// (Mercado Pago Point o TUU). Solo si el negocio activó «Cobro en la máquina» (apagado por defecto). El monto sale del servidor.
// La máquina es la PERSONAL del profesional de la cita si trabaja en arriendo y tiene la suya (como el POS); si no, la del negocio.
// Opción A: al aprobarse se avisa al profesional y a administración; la venta la registra el equipo en el POS.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`pagoterm:${ipDe(req)}`, 8)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(supabase, body.codigo);
  if (!t) return NextResponse.json({ error: "Tótem no disponible" }, { status: 404 });
  if (!t.kiosk_terminal_enabled) return NextResponse.json({ error: "El cobro en la máquina no está activado en este local." }, { status: 403 });

  // Una o varias citas del mismo cliente con el mismo profesional (appointmentIds); se valida y se suma todo en el servidor.
  const cc = await citasParaCobro(supabase, t.id, body.code, Array.isArray(body.appointmentIds) ? body.appointmentIds : [body.appointmentId]);
  if (!cc.ok) return NextResponse.json({ error: cc.error }, { status: cc.status });
  const a = { id: cc.primeraId, barber_id: cc.barberId };
  // Productos (cosméticos) que el cliente agregó antes de pagar: se cobran junto al servicio, con precios del servidor.
  let extraItems: any[] | null = null;
  let extraTotal = 0;
  if (Array.isArray(body.productos) && body.productos.length) {
    const c = await armarItemsProductos(supabase, t.id, body.productos, true);
    if (!c.ok) return NextResponse.json({ error: c.error }, { status: c.status });
    extraItems = c.items; extraTotal = c.total;
  }
  // Otras personas que pagan en el mismo cobro (cada una con su código y su propia venta).
  const otras = await citasDeOtrasPersonas(supabase, t.id, cc, body.otros);
  if (!otras.ok) return NextResponse.json({ error: otras.error }, { status: otras.status });
  const s = { saldo: cc.saldo + otras.saldo + extraTotal, abono: cc.abono + otras.abono, total: cc.total + otras.total + extraTotal };
  const extraIds = [...cc.extraIds, ...otras.extraIds];

  const term = await resolverTerminal(supabase, t.id, (a as any).barber_id);
  if (!term) return NextResponse.json({ error: "Tu profesional no tiene una máquina de tarjetas conectada. Elige pagar en caja y avisamos al equipo." }, { status: 400 });

  // Una máquina atiende un cobro a la vez (cada profesional en arriendo tiene la suya): si ESA máquina tiene otro cobro pendiente
  // hace menos de 3 minutos (de otra cita) se pide esperar. Si el pendiente es de esta misma cita (el cliente reintentó), se cancela y se crea uno nuevo.
  const hace3 = new Date(Date.now() - 3 * 60_000).toISOString();
  const { data: pendientes } = await supabase.from("kiosk_payments").select("id, appointment_id, external_id, module").eq("tenant_id", t.id).eq("method", "terminal").eq("device", term.device).eq("status", "pending").gte("created_at", hace3);
  const modulo = moduloDe(req);
  for (const p of pendientes || []) {
    // Un cobro pendiente del MISMO módulo es de alguien que ya se fue o reintenta: se cancela. Solo bloquea el de OTRO módulo con la misma máquina física.
    const mismoModulo = modulo > 0 && Number((p as any).module) === modulo;
    if (!mismoModulo && (p as any).appointment_id !== (a as any).id) return NextResponse.json({ error: "La máquina está atendiendo a otra persona. Intenta en un momento." }, { status: 409 });
    if ((p as any).external_id) await cancelarCobro(term, (p as any).external_id);
    await supabase.from("kiosk_payments").update({ status: "cancelled" }).eq("id", (p as any).id);
  }

  const fila = { ...(extraItems ? { items: extraItems } : {}), tenant_id: t.id, appointment_id: (a as any).id, ...(extraIds.length ? { appointment_ids: extraIds } : {}), ...(modulo > 0 ? { module: modulo } : {}), amount: s.saldo, method: "terminal", provider: term.proveedor, device: term.device };
  // card_type (migración 169) sirve para registrar si fue débito o crédito; si la migración aún no está, se crea igual sin él.
  let ins: any = await supabase.from("kiosk_payments").insert({ ...fila, card_type: body.tarjeta === "credito" ? "credito" : "debito" }).select("id").single();
  if (ins.error && /card_type/i.test(ins.error.message)) ins = await supabase.from("kiosk_payments").insert(fila).select("id").single();
  const { data: kp, error } = ins;
  if (error || !kp) return NextResponse.json({ error: "No pudimos crear el cobro. Avisa a quien te atiende." }, { status: 500 });

  const r = await iniciarCobro(term, { amount: s.saldo, descripcion: `Servicio - ${t.name}`, referencia: `kt-${(kp as any).id}`, tarjeta: body.tarjeta === "credito" ? "credito" : "debito" });
  if (!r.ok) {
    await supabase.from("kiosk_payments").update({ status: "failed" }).eq("id", (kp as any).id);
    return NextResponse.json({ error: r.error }, { status: 502 });
  }
  await supabase.from("kiosk_payments").update({ external_id: r.externalId }).eq("id", (kp as any).id);

  // Si el cobro salió a la máquina PERSONAL del profesional, se le avisa a él para que la tenga a mano.
  let profesional: string | null = null;
  if (term.personal && term.barberId) {
    const { data: pro } = await supabase.from("profiles").select("name").eq("id", term.barberId).maybeSingle();
    profesional = (pro as any)?.name || null;
    const { data: cl } = await supabase.from("appointments").select("client:clients(name)").eq("id", (a as any).id).maybeSingle();
    await notify({
      tenantId: t.id, kind: "kiosk_payment", userIds: [term.barberId], professionalId: term.barberId,
      title: "Cobro enviado a tu máquina",
      body: `${primerNombre((cl as any)?.client?.name) || "Un cliente"} va a pagar $${s.saldo.toLocaleString("es-CL")} con tarjeta en tu máquina (desde el tótem).`,
      url: "/dashboard/mi-agenda",
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true, id: (kp as any).id, monto: s.saldo, abono: s.abono, proveedor: term.proveedor, profesional });
}
