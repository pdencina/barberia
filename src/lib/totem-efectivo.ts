// Pago en EFECTIVO desde el tótem: el cliente lo pide con su código y NADA se registra hasta que el profesional (o administración), con su sesión
// iniciada, confirma que recibió el dinero. Si coincide se registra la venta en efectivo (entra a la caja); si no coincide no se registra y se avisa.
import { confirmarPagoTotem } from "@/lib/totem-pago";
import { notify } from "@/lib/notify";

export interface EfectivoPendiente {
  id: string; monto: number; creado: string; barberId: string | null; profesional: string;
  personas: Array<{ cliente: string; servicios: string[] }>;
  productos: Array<{ name: string; quantity: number }>;
}

const VIGENCIA_MS = 60 * 60_000; // un pedido sin responder deja de mostrarse a la hora

// Pedidos en efectivo sin responder. soloBarberId: un profesional ve solo los suyos.
export async function efectivoPendiente(supabase: any, tenantId: string, soloBarberId?: string | null): Promise<EfectivoPendiente[]> {
  const desde = new Date(Date.now() - VIGENCIA_MS).toISOString();
  const { data } = await supabase.from("kiosk_payments").select("id, amount, created_at, appointment_id, appointment_ids, items").eq("tenant_id", tenantId).eq("method", "cash").eq("status", "pending").gte("created_at", desde).order("created_at").limit(20);
  const out: EfectivoPendiente[] = [];
  for (const kp of data || []) {
    const ids = [kp.appointment_id, ...(kp.appointment_ids || [])].filter(Boolean);
    const { data: citas } = await supabase.from("appointments").select("id, barber_id, client_id, client:clients(name), barber:profiles!barber_id(name), appointment_services(services(name))").in("id", ids).eq("tenant_id", tenantId);
    const principal: any = (citas || []).find((c: any) => c.id === kp.appointment_id);
    if (!principal || (soloBarberId && principal.barber_id !== soloBarberId)) continue;
    const porCliente = new Map<string, { cliente: string; servicios: string[] }>();
    for (const id of ids) {
      const c: any = (citas || []).find((x: any) => x.id === id);
      if (!c) continue;
      const g = porCliente.get(c.client_id || c.id) || { cliente: String(c.client?.name || "Cliente"), servicios: [] as string[] };
      g.servicios.push(...(c.appointment_services || []).map((s: any) => s.services?.name).filter(Boolean));
      porCliente.set(c.client_id || c.id, g);
    }
    out.push({
      id: kp.id, monto: Math.round(Number(kp.amount) || 0), creado: kp.created_at, barberId: principal.barber_id, profesional: principal.barber?.name || "",
      personas: Array.from(porCliente.values()),
      productos: (Array.isArray(kp.items) ? kp.items : []).map((i: any) => ({ name: i.name, quantity: Number(i.quantity) || 1 })),
    });
  }
  return out;
}

// Respuesta del equipo. coincide=true: se registra la venta en efectivo (una sola vez). coincide=false: no se registra y se avisa a administración.
export async function resolverEfectivo(
  supabase: any,
  o: { tenantId: string; id: string; coincide: boolean; userId: string; soloBarberId?: string | null },
): Promise<{ ok: true; registrada: boolean } | { ok: false; error: string; status: number }> {
  const { data: kp } = await supabase.from("kiosk_payments").select("id, tenant_id, appointment_id, appointment_ids, amount, status, method").eq("id", o.id).eq("tenant_id", o.tenantId).eq("method", "cash").maybeSingle();
  if (!kp) return { ok: false, error: "No encontramos ese pago", status: 404 };
  const { data: cita } = await supabase.from("appointments").select("barber_id, client:clients(name)").eq("id", kp.appointment_id).maybeSingle();
  if (o.soloBarberId && cita?.barber_id !== o.soloBarberId) return { ok: false, error: "Ese pago es de otro profesional", status: 403 };
  if (kp.status !== "pending") return { ok: false, error: kp.status === "paid" ? "Ese pago ya fue confirmado" : "Ese pago ya no está pendiente", status: 409 };

  const { data: quien } = await supabase.from("profiles").select("name").eq("id", o.userId).maybeSingle();
  const monto = Math.round(Number(kp.amount) || 0);

  if (!o.coincide) {
    const { data: marcado } = await supabase.from("kiosk_payments").update({ status: "failed" }).eq("id", kp.id).eq("status", "pending").select("id").maybeSingle();
    if (!marcado) return { ok: false, error: "Ese pago ya no está pendiente", status: 409 };
    await notify({
      tenantId: o.tenantId, kind: "kiosk_payment", roles: ["admin"], professionalId: cita?.barber_id || null,
      title: "Efectivo no coincide", body: `${quien?.name || "El equipo"} indicó que el efectivo NO coincide: pedido de $${monto.toLocaleString("es-CL")} de ${cita?.client?.name || "un cliente"} en el tótem. No se registró la venta.`,
      url: "/dashboard/caja",
    }).catch(() => {});
    await supabase.from("audit_log").insert({ action: "kiosk_cash_mismatch", entity_type: "kiosk_payment", entity_id: kp.id, description: `Efectivo no coincide: $${monto.toLocaleString("es-CL")}`, user_id: o.userId, user_name: quien?.name || "", metadata: { tenantId: o.tenantId } }).then(() => {}, () => {});
    return { ok: true, registrada: false };
  }

  // Si alguna de esas citas ya se pagó por otro medio desde el tótem, no se registra de nuevo.
  for (const id of [kp.appointment_id, ...(kp.appointment_ids || [])]) {
    const p1 = await supabase.from("kiosk_payments").select("id").eq("appointment_id", id).eq("status", "paid").limit(1).maybeSingle();
    const p2 = await supabase.from("kiosk_payments").select("id").contains("appointment_ids", [id]).eq("status", "paid").limit(1).maybeSingle();
    if (p1.data || p2.data) {
      await supabase.from("kiosk_payments").update({ status: "cancelled" }).eq("id", kp.id).eq("status", "pending");
      return { ok: false, error: "Esa cita ya fue pagada con otro medio. No se registra el efectivo.", status: 409 };
    }
  }
  const marcado = await confirmarPagoTotem(supabase, kp, monto, `efectivo:${o.userId}`, "en efectivo", "cash");
  if (!marcado) return { ok: false, error: "Ese pago ya no está pendiente", status: 409 };
  await supabase.from("audit_log").insert({ action: "kiosk_cash_confirmed", entity_type: "kiosk_payment", entity_id: kp.id, description: `Efectivo recibido y confirmado: $${monto.toLocaleString("es-CL")}`, user_id: o.userId, user_name: quien?.name || "", metadata: { tenantId: o.tenantId } }).then(() => {}, () => {});
  const { data: venta } = await supabase.from("kiosk_payments").select("transaction_id").eq("id", kp.id).maybeSingle();
  return { ok: true, registrada: !!venta?.transaction_id };
}
