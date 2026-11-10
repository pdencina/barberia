// Abonos pagados al reservar que aún no se descuentan en ninguna venta. Sirven aunque la clienta cambie la hora o la cita
// (o el negocio la mueva, la cancele y cree otra): el abono es de la persona, no de una cita en particular.
// Se reconoce por la cita original, por el cliente de esa cita o por el correo con que se pagó.

export interface AbonoDisponible { paymentId: string; monto: number; citaId: string | null; fecha: string; citaEstado: string | null }

export const DIAS_VIGENCIA_ABONO = 120; // un abono más viejo que esto ya no se ofrece solo (se puede revisar en Abonos)

// Puro: de los abonos disponibles, cuáles se usan para cubrir `tope` pesos (los más antiguos primero). El monto aplicado nunca pasa del tope.
export function elegirAbonos(disponibles: AbonoDisponible[], tope: number): { usados: AbonoDisponible[]; monto: number } {
  const limite = Math.max(0, Math.round(Number(tope) || 0));
  const usados: AbonoDisponible[] = [];
  let suma = 0;
  for (const a of [...disponibles].sort((x, y) => x.fecha.localeCompare(y.fecha))) {
    if (suma >= limite) break;
    usados.push(a); suma += Math.max(0, Math.round(a.monto));
  }
  return { usados, monto: Math.min(suma, limite) };
}

const ESTADOS_NO_OFRECER = ["completed", "no_show"]; // la cita ya se atendió (o no llegó): ese abono ya tuvo su destino

// Busca los abonos disponibles de una persona (por cita, cliente o correo). Tolera que falte la migración 152.
export async function buscarAbonosDisponibles(sb: any, o: { tenantId: string; clientId?: string | null; appointmentId?: string | null }): Promise<AbonoDisponible[]> {
  const { tenantId } = o;
  if (!tenantId) return [];
  const cols = "payment_id, appointment_id, amount, payer_email, created_at";
  const desde = new Date(Date.now() - DIAS_VIGENCIA_ABONO * 86400000).toISOString();
  const base = (conAplicado: boolean) => {
    let q = sb.from("booking_deposits").select(cols).eq("tenant_id", tenantId).eq("status", "approved").gte("created_at", desde);
    if (conAplicado) q = q.is("applied_transaction_id", null);
    return q;
  };
  let conAplicado = true;
  const probe = await base(true).limit(1);
  if (probe.error) { conAplicado = false; const p2 = await base(false).limit(1); if (p2.error) return legacyPorCita(sb, o); }

  const filas = new Map<string, any>();
  const agregar = (r: { data: any[] | null }) => { for (const f of r.data || []) filas.set(f.payment_id, f); };

  let email: string | null = null; let citasCliente: string[] = [];
  if (o.clientId) {
    const { data: c } = await sb.from("clients").select("email").eq("id", o.clientId).eq("tenant_id", tenantId).maybeSingle();
    email = c?.email ? String(c.email).trim().toLowerCase() : null;
    const { data: cs } = await sb.from("appointments").select("id").eq("tenant_id", tenantId).eq("client_id", o.clientId).gte("date", desde.slice(0, 10)).limit(500);
    citasCliente = (cs || []).map((x: any) => x.id);
  }
  if (o.appointmentId) agregar(await base(conAplicado).eq("appointment_id", o.appointmentId));
  if (citasCliente.length) agregar(await base(conAplicado).in("appointment_id", citasCliente));
  if (email) agregar(await base(conAplicado).ilike("payer_email", email.replace(/[\\_%]/g, "\\$&")));

  const lista = Array.from(filas.values());
  const ids = Array.from(new Set(lista.map((f: any) => f.appointment_id).filter(Boolean)));
  const estados = new Map<string, string>();
  if (ids.length) { const { data: ap } = await sb.from("appointments").select("id, status").in("id", ids); for (const a of ap || []) estados.set(a.id, a.status); }
  return lista
    .map((f: any): AbonoDisponible => ({ paymentId: f.payment_id, monto: Math.max(0, Math.round(Number(f.amount) || 0)), citaId: f.appointment_id || null, fecha: String(f.created_at || ""), citaEstado: f.appointment_id ? (estados.get(f.appointment_id) ?? null) : null }))
    // La cita que se está cobrando ahora siempre cuenta; las otras solo si su cita no se atendió ya.
    .filter((a) => a.monto > 0 && (a.citaId === o.appointmentId || !ESTADOS_NO_OFRECER.includes(a.citaEstado || "")));
}

// Sin la tabla/columna nuevas: solo el abono de la propia cita, como funcionaba antes.
async function legacyPorCita(sb: any, o: { tenantId: string; appointmentId?: string | null }): Promise<AbonoDisponible[]> {
  if (!o.appointmentId) return [];
  const { data: a } = await sb.from("appointments").select("id, tenant_id, deposit_amount, deposit_status, deposit_payment_id, created_at, status").eq("id", o.appointmentId).maybeSingle();
  if (!a || a.tenant_id !== o.tenantId || a.deposit_status !== "paid") return [];
  const monto = Math.max(0, Math.round(Number(a.deposit_amount) || 0));
  return monto > 0 ? [{ paymentId: String(a.deposit_payment_id || `cita:${a.id}`), monto, citaId: a.id, fecha: String(a.created_at || ""), citaEstado: a.status ?? null }] : [];
}

// Anota que estos abonos ya se descontaron en la venta `txId` (para no descontarlos dos veces). Nunca lanza error.
export async function marcarAbonosAplicados(sb: any, paymentIds: string[], txId: string): Promise<void> {
  const ids = paymentIds.filter((x) => x && !x.startsWith("cita:"));
  if (!ids.length) return;
  try { await sb.from("booking_deposits").update({ applied_transaction_id: txId, applied_at: new Date().toISOString() }).in("payment_id", ids).is("applied_transaction_id", null); } catch { /* sin la migración 152 */ }
}
