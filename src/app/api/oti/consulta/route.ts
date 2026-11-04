import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { chileDayBoundsUtc } from "@/lib/utils";
import { fetchAllRows } from "@/lib/accounting";

export const dynamic = "force-dynamic";

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MEDIOS = ["credit_card", "debit_card", "cash", "transfer"];
const trozos = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// Cifras para Oti. SOLO administrador/super admin. El negocio sale de la sesion (nunca del navegador) y cada filtro lleva tenant_id.
export async function POST(req: NextRequest) {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const { tenantId } = await resolveTenantForRequest(null);
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ error: "Elige un negocio para consultar sus cifras." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { metrica, desde, hasta, barberId, medio } = body as Record<string, any>;
  if (!["dinero", "servicios", "ranking"].includes(metrica) || !FECHA.test(desde || "") || !FECHA.test(hasta || "") || desde > hasta)
    return NextResponse.json({ error: "Consulta no valida" }, { status: 400 });
  if (Date.parse(hasta) - Date.parse(desde) > 400 * 86400000) return NextResponse.json({ error: "Periodo demasiado largo" }, { status: 400 });
  if (medio !== undefined && !MEDIOS.includes(medio)) return NextResponse.json({ error: "Medio de pago no valido" }, { status: 400 });

  const supabase = createAdminSupabase();
  if (barberId !== undefined) {
    if (typeof barberId !== "string") return NextResponse.json({ error: "Profesional no valido" }, { status: 400 });
    const { data: p } = await supabase.from("profiles").select("id").eq("id", barberId).eq("tenant_id", tenantId).maybeSingle();
    if (!p) return NextResponse.json({ error: "Ese profesional no es de tu negocio" }, { status: 404 });
  }

  const ini = chileDayBoundsUtc(desde).startUtc;
  const fin = chileDayBoundsUtc(new Date(Date.parse(hasta) + 86400000).toISOString().slice(0, 10)).startUtc;
  let tx: { id: string; total: number | null; barber_id: string | null; payment_method: string | null }[];
  try {
    tx = await fetchAllRows(() => {
      let q = supabase.from("transactions").select("id, total, barber_id, payment_method")
        .eq("tenant_id", tenantId).eq("type", "income").eq("status", "completed").gte("created_at", ini).lt("created_at", fin);
      if (barberId) q = q.eq("barber_id", barberId);
      return q;
    });
  } catch { return NextResponse.json({ error: "No pude leer las ventas" }, { status: 500 }); }

  // Monto por venta, segun el medio pedido (las ventas mixtas se reparten con sus pagos).
  let montos = new Map<string, number>(tx.map((t) => [t.id, Number(t.total) || 0]));
  if (medio) {
    montos = new Map();
    const mixtas = tx.filter((t) => t.payment_method === "mixed").map((t) => t.id);
    for (const t of tx) if (t.payment_method === medio) montos.set(t.id, Number(t.total) || 0);
    for (const ids of trozos(mixtas, 150)) {
      const { data } = await supabase.from("transaction_payments").select("transaction_id, amount").in("transaction_id", ids).eq("payment_method", medio);
      for (const r of (data as any[]) || []) montos.set(r.transaction_id, (montos.get(r.transaction_id) || 0) + (Number(r.amount) || 0));
    }
  }
  const dentro = tx.filter((t) => montos.has(t.id));

  if (metrica === "dinero") {
    const total = dentro.reduce((s, t) => s + (montos.get(t.id) || 0), 0);
    return NextResponse.json({ total: clp(total), ventas: dentro.length });
  }

  // Servicios realizados (lineas de tipo servicio de cada venta).
  const porBarbero = new Map<string, { servicios: number; dinero: number }>();
  let servicios = 0;
  const duenoDe = new Map(tx.map((t) => [t.id, t.barber_id]));
  for (const ids of trozos(dentro.map((t) => t.id), 150)) {
    const { data } = await supabase.from("transaction_items").select("transaction_id, quantity, service_id").in("transaction_id", ids).not("service_id", "is", null);
    for (const it of (data as any[]) || []) {
      const q = Number(it.quantity) || 1;
      servicios += q;
      const b = duenoDe.get(it.transaction_id);
      if (b) porBarbero.set(b, { servicios: (porBarbero.get(b)?.servicios || 0) + q, dinero: porBarbero.get(b)?.dinero || 0 });
    }
  }
  if (metrica === "servicios") return NextResponse.json({ servicios, ventas: dentro.length });

  for (const t of dentro) if (t.barber_id) { const c = porBarbero.get(t.barber_id) || { servicios: 0, dinero: 0 }; c.dinero += montos.get(t.id) || 0; porBarbero.set(t.barber_id, c); }
  const ids = Array.from(porBarbero.keys());
  const { data: perfiles } = ids.length ? await supabase.from("profiles").select("id, name").eq("tenant_id", tenantId).in("id", ids) : { data: [] as any[] };
  const nombre = new Map((perfiles as any[]).map((p) => [p.id, p.name as string]));
  const ranking = ids.filter((id) => nombre.has(id)).map((id) => ({ nombre: nombre.get(id)!, servicios: porBarbero.get(id)!.servicios, dinero: clp(porBarbero.get(id)!.dinero) }))
    .sort((a, b) => b.servicios - a.servicios).slice(0, 5);
  return NextResponse.json({ ranking });
}
