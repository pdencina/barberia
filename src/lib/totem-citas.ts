// Cobro de UNA O VARIAS citas del mismo cliente con el mismo profesional (el cliente las elige juntas en el tótem y paga una sola vez).
// Todo se valida en el servidor: las citas deben ser de hoy, de este negocio, del código escrito y con el MISMO profesional.
import { soloDiaDelTotem, normalizarCodigo } from "@/lib/totem";
import { saldoCita } from "@/lib/totem-pago";

export type CitasParaCobro =
  | { ok: true; primeraId: string; barberId: string; extraIds: string[]; total: number; abono: number; saldo: number }
  | { ok: false; error: string; status: number };

export async function citasParaCobro(supabase: any, tenantId: string, codeRaw: unknown, idsRaw: unknown): Promise<CitasParaCobro> {
  const code = normalizarCodigo(codeRaw);
  const ids = Array.from(new Set((Array.isArray(idsRaw) ? idsRaw : [idsRaw]).map((x) => String(x || "")).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))).slice(0, 4);
  if (ids.length === 0 || code.length !== 5) return { ok: false, error: "Falta el código", status: 400 };

  const { data } = await soloDiaDelTotem(supabase.from("appointments").select("id, status, checkin_code, barber_id").in("id", ids).eq("tenant_id", tenantId));
  const citas: any[] = data || [];
  if (citas.length !== ids.length || citas.some((c) => c.checkin_code !== code || !["scheduled", "confirmed", "in_progress", "completed"].includes(c.status))) {
    return { ok: false, error: "No encontramos tu cita", status: 404 };
  }
  if (new Set(citas.map((c) => c.barber_id)).size > 1) return { ok: false, error: "Solo se pueden pagar juntas las citas con el mismo profesional.", status: 400 };

  let total = 0, abono = 0, saldo = 0;
  for (const c of citas) {
    const s = await saldoCita(supabase, c.id);
    if (!s || s.total <= 0) return { ok: false, error: "Una de las citas no tiene un monto para cobrar. Avisa a quien te atiende.", status: 400 };
    total += s.total; abono += s.abono; saldo += s.saldo;
    // Si ya se pagó desde el tótem (sola o junto con otra), no se cobra dos veces.
    const { data: p1 } = await supabase.from("kiosk_payments").select("id").eq("appointment_id", c.id).eq("status", "paid").limit(1).maybeSingle();
    const p2 = await supabase.from("kiosk_payments").select("id").contains("appointment_ids", [c.id]).eq("status", "paid").limit(1).maybeSingle();
    if (p1 || p2.data) return { ok: false, error: "Esta cita ya fue pagada desde el tótem.", status: 409 };
  }
  if (saldo <= 0) return { ok: false, error: "Tu cita ya está pagada con el abono.", status: 400 };
  const orden = ids.filter((id) => citas.some((c) => c.id === id));
  return { ok: true, primeraId: orden[0], barberId: citas[0].barber_id, extraIds: orden.slice(1), total, abono, saldo };
}
