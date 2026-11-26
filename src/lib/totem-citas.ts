// Cobro de UNA O VARIAS citas del mismo cliente con el mismo profesional (el cliente las elige juntas en el tótem y paga una sola vez).
// Todo se valida en el servidor: las citas deben ser de hoy, de este negocio, del código escrito y con el MISMO profesional.
import { soloDiaDelTotem, normalizarCodigo } from "@/lib/totem";
import { saldoCita } from "@/lib/totem-pago";

// Citas que YA se cobraron (en el POS o en el tótem). Una cita completada también cuenta como cobrada si ese cliente tiene ese día una venta
// de servicios (el POS no siempre deja la venta unida a la cita, y varias citas pagadas juntas quedan unidas a una sola). Ante la duda, no se cobra.
export async function citasYaCobradas(supabase: any, tenantId: string, citas: Array<{ id: string; client_id: string | null; date: string; status: string }>): Promise<Set<string>> {
  const out = new Set<string>();
  for (const c of citas) {
    const venta = await supabase.from("transactions").select("id").eq("tenant_id", tenantId).eq("appointment_id", c.id).limit(1);
    if (venta.data?.length) { out.add(c.id); continue; }
    const p1 = await supabase.from("kiosk_payments").select("id").eq("appointment_id", c.id).eq("status", "paid").limit(1);
    const p2 = await supabase.from("kiosk_payments").select("id").contains("appointment_ids", [c.id]).eq("status", "paid").limit(1);
    if (p1.data?.length || p2.data?.length) { out.add(c.id); continue; }
    if (c.status !== "completed") continue;
    if (venta.error || !c.client_id) { out.add(c.id); continue; }
    const { data: delDia, error } = await supabase.from("transactions").select("id, transaction_items(service_id)").eq("tenant_id", tenantId).eq("client_id", c.client_id).eq("type", "income").gte("created_at", `${c.date}T00:00:00-03:00`).limit(20);
    if (error || (delDia || []).some((t: any) => !t.transaction_items?.length || t.transaction_items.some((i: any) => i.service_id))) out.add(c.id);
  }
  return out;
}

export type CitasParaCobro =
  | { ok: true; primeraId: string; barberId: string; extraIds: string[]; total: number; abono: number; saldo: number }
  | { ok: false; error: string; status: number };

export async function citasParaCobro(supabase: any, tenantId: string, codeRaw: unknown, idsRaw: unknown): Promise<CitasParaCobro> {
  const code = normalizarCodigo(codeRaw);
  const ids = Array.from(new Set((Array.isArray(idsRaw) ? idsRaw : [idsRaw]).map((x) => String(x || "")).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))).slice(0, 4);
  if (ids.length === 0 || code.length !== 5) return { ok: false, error: "Falta el código", status: 400 };

  const { data } = await soloDiaDelTotem(supabase.from("appointments").select("id, status, checkin_code, barber_id, client_id, date").in("id", ids).eq("tenant_id", tenantId));
  const citas: any[] = data || [];
  if (citas.length !== ids.length || citas.some((c) => c.checkin_code !== code || !["scheduled", "confirmed", "in_progress", "completed"].includes(c.status))) {
    return { ok: false, error: "No encontramos tu cita", status: 404 };
  }
  if (new Set(citas.map((c) => c.barber_id)).size > 1) return { ok: false, error: "Solo se pueden pagar juntas las citas con el mismo profesional.", status: 400 };

  const cobradas = await citasYaCobradas(supabase, tenantId, citas);
  let total = 0, abono = 0, saldo = 0;
  for (const c of citas) {
    const s = await saldoCita(supabase, c.id);
    if (!s || s.total <= 0) return { ok: false, error: "Una de las citas no tiene un monto para cobrar. Avisa a quien te atiende.", status: 400 };
    total += s.total; abono += s.abono; saldo += s.saldo;
    // Si ya se pagó desde el tótem (sola o junto con otra), no se cobra dos veces.
    const { data: p1 } = await supabase.from("kiosk_payments").select("id").eq("appointment_id", c.id).eq("status", "paid").limit(1).maybeSingle();
    const p2 = await supabase.from("kiosk_payments").select("id").contains("appointment_ids", [c.id]).eq("status", "paid").limit(1).maybeSingle();
    if (p1 || p2.data) return { ok: false, error: "Esta cita ya fue pagada desde el tótem.", status: 409 };
    if (cobradas.has(c.id)) return { ok: false, error: "Esta cita ya está pagada. Si tienes dudas, avisa a quien te atiende.", status: 409 };
  }
  if (saldo <= 0) return { ok: false, error: "Tu cita ya está pagada con el abono.", status: 400 };
  const orden = ids.filter((id) => citas.some((c) => c.id === id));
  return { ok: true, primeraId: orden[0], barberId: citas[0].barber_id, extraIds: orden.slice(1), total, abono, saldo };
}

// Cobro compartido: además de las citas del cliente principal, las de OTRAS personas (cada una con su propio código) que pagan en el mismo cobro.
// body.otros = [{ code, appointmentIds }]. Todas deben ser del mismo profesional; cada persona sigue teniendo su propia venta.
export type CobroCompartido =
  | { ok: true; extraIds: string[]; saldo: number; abono: number; total: number }
  | { ok: false; error: string; status: number };

export async function citasDeOtrasPersonas(supabase: any, tenantId: string, principal: { primeraId: string; extraIds: string[]; barberId: string }, otrosRaw: unknown): Promise<CobroCompartido> {
  const otros: any[] = Array.isArray(otrosRaw) ? otrosRaw.slice(0, 3) : [];
  const usadas = new Set<string>([principal.primeraId, ...principal.extraIds]);
  const extraIds: string[] = [];
  let saldo = 0, abono = 0, total = 0;
  const codigos = new Set<string>();
  for (const o of otros) {
    const code = normalizarCodigo(o?.code);
    if (codigos.has(code)) return { ok: false, error: "Ese código ya está en el pago.", status: 400 };
    codigos.add(code);
    const c = await citasParaCobro(supabase, tenantId, o?.code, o?.appointmentIds);
    if (!c.ok) return c;
    if (c.barberId !== principal.barberId) return { ok: false, error: "Solo se pueden pagar juntas las citas con el mismo profesional.", status: 400 };
    for (const id of [c.primeraId, ...c.extraIds]) {
      if (usadas.has(id)) return { ok: false, error: "Esa cita ya está en el pago.", status: 400 };
      usadas.add(id); extraIds.push(id);
    }
    saldo += c.saldo; abono += c.abono; total += c.total;
  }
  return { ok: true, extraIds, saldo, abono, total };
}
