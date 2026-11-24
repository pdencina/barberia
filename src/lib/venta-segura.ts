// Protecciones para que el dinero y las citas siempre cuadren:
// 1) no registrar dos veces la misma venta (corte de luz, doble toque, reintento) sin avisar;
// 2) no dejar una cita «Completada» sin un cobro registrado;
// 3) enlazar cada venta con su cita.
export const MINUTOS_VENTA_REPETIDA = 15;

export interface VentaPrevia { id: string; total: number; hace_min: number; metodo: string | null }

// ¿Hay una venta igual (mismo negocio, profesional, cliente y total) de hace pocos minutos? Sin cliente no se compara (no hay forma segura).
export async function buscarVentaRepetida(sb: any, p: { tenantId: string | null; barberId: string; clientId: string | null; total: number; ahora?: Date }): Promise<VentaPrevia | null> {
  if (!p.clientId || !(p.total > 0)) return null;
  const ahora = p.ahora || new Date();
  const desde = new Date(ahora.getTime() - MINUTOS_VENTA_REPETIDA * 60000).toISOString();
  let q = sb.from("transactions").select("id, total, payment_method, created_at").eq("type", "income").eq("status", "completed")
    .eq("barber_id", p.barberId).eq("client_id", p.clientId).eq("total", p.total).gte("created_at", desde).order("created_at", { ascending: false }).limit(1);
  if (p.tenantId) q = q.eq("tenant_id", p.tenantId);
  const { data } = await q;
  const v = (data as any[])?.[0];
  if (!v) return null;
  return { id: v.id, total: Number(v.total), metodo: v.payment_method || null, hace_min: Math.max(0, Math.round((ahora.getTime() - new Date(v.created_at).getTime()) / 60000)) };
}

export const textoVentaRepetida = (v: VentaPrevia) =>
  `Ya hay una venta igual (mismo cliente, profesional y monto) registrada hace ${v.hace_min} min. Si fue por un corte de luz o un doble toque, NO la repitas. ¿Es realmente otra venta?`;

// ¿La cita tiene al menos un cobro? Cuenta el enlazado a la cita o, en ventas antiguas sin enlace, una venta del mismo cliente ese día.
export async function citaTieneCobro(sb: any, cita: { id: string; client_id: string | null; date: string; tenant_id: string }): Promise<boolean> {
  const { data: directa } = await sb.from("transactions").select("id").eq("appointment_id", cita.id).eq("status", "completed").limit(1);
  if ((directa as any[])?.length) return true;
  if (!cita.client_id) return false;
  const { startUtc, endUtc } = (await import("@/lib/utils")).chileDayBoundsUtc(cita.date);
  const { data: delDia } = await sb.from("transactions").select("id").eq("tenant_id", cita.tenant_id).eq("client_id", cita.client_id)
    .eq("type", "income").eq("status", "completed").gte("created_at", startUtc).lt("created_at", endUtc).limit(1);
  return !!(delDia as any[])?.length;
}
