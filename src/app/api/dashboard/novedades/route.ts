import { NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";
import { chileDayBoundsUtc, dateStrOffset, todayInChile } from "@/lib/utils";
import {
  lunesDe, novedadesProfesionales, novedadesGenerales, novedadesCancelacionesCuenta, novedadCampana, novedadesAlertas, ordenarNovedades,
  type Campana, type Novedad,
} from "@/lib/novedades";

export const dynamic = "force-dynamic";

const trozos = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// Novedades de la semana (qué funcionó, qué empeoró y alertas) del negocio. Solo administrador; el negocio sale de la sesión.
// Cada bloque se calcula por separado: si uno falla (por ejemplo, una tabla que aún no existe), los demás siguen.
export async function GET() {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const { tenantId } = await resolveTenantForRequest(null);
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ semana: lunesDe(todayInChile()), novedades: [] });

  const sb = createAdminSupabase();
  const hoy = todayInChile();
  const desde = dateStrOffset(hoy, -6), prevDesde = dateStrOffset(hoy, -13), prevHasta = dateStrOffset(hoy, -7);
  const w = {
    ini: chileDayBoundsUtc(desde).startUtc, fin: chileDayBoundsUtc(hoy).endUtc,
    pIni: chileDayBoundsUtc(prevDesde).startUtc, pFin: chileDayBoundsUtc(prevHasta).endUtc,
  };
  const novedades: Novedad[] = [];
  const nombres = new Map<string, string>();
  const recepcion = new Set<string>();
  try {
    const { data } = await sb.from("profiles").select("id, name, role").eq("tenant_id", tenantId);
    for (const p of (data as any[]) || []) { nombres.set(p.id, p.name); if (p.role === "receptionist") recepcion.add(p.id); }
  } catch { /* sin nombres: los avisos de profesionales no salen */ }

  // ---- ventas (total y por profesional) ----
  let ventas = 0, ventasPrev = 0;
  try {
    const tx = await fetchAllRows<any>(() => sb.from("transactions").select("id, total, barber_id, created_at")
      .eq("tenant_id", tenantId).eq("type", "income").eq("status", "completed").gte("created_at", w.pIni).lt("created_at", w.fin));
    const pro = new Map<string, { actual: number; previo: number }>();
    for (const t of tx) {
      const esActual = t.created_at >= w.ini;
      const monto = Number(t.total) || 0;
      if (esActual) ventas += monto; else if (t.created_at < w.pFin) ventasPrev += monto; else continue;
      if (t.barber_id && !recepcion.has(t.barber_id)) { const c = pro.get(t.barber_id) || { actual: 0, previo: 0 }; if (esActual) c.actual += monto; else c.previo += monto; pro.set(t.barber_id, c); }
    }
    novedades.push(...novedadesProfesionales(Array.from(pro.entries()).map(([id, c]) => ({ id, nombre: nombres.get(id) || "Un profesional", ...c }))));
  } catch (e) { console.error("[novedades] ventas:", e); }

  // ---- clientes nuevos, cancelaciones y reservas por el link ----
  try {
    const contar = async (tabla: string, col: string, ini: string, fin: string, extra?: (q: any) => any) => {
      let q: any = sb.from(tabla).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte(col, ini).lt(col, fin);
      if (extra) q = extra(q);
      const { count } = await q; return count || 0;
    };
    const citasCanceladas = async (a: string, b: string) => {
      const { count } = await sb.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("date", a).lte("date", b).in("status", ["cancelled", "no_show"]);
      return count || 0;
    };
    const [clientesNuevos, clientesNuevosPrev, cancelaciones, cancelacionesPrev, reservasLink, reservasLinkPrev] = await Promise.all([
      contar("clients", "created_at", w.ini, w.fin), contar("clients", "created_at", w.pIni, w.pFin),
      citasCanceladas(desde, hoy), citasCanceladas(prevDesde, prevHasta),
      contar("appointments", "created_at", w.ini, w.fin, (q) => q.eq("source", "link").neq("status", "cancelled")),
      contar("appointments", "created_at", w.pIni, w.pFin, (q) => q.eq("source", "link").neq("status", "cancelled")),
    ]);
    novedades.push(...novedadesGenerales({ ventas, ventasPrev, clientesNuevos, clientesNuevosPrev, cancelaciones, cancelacionesPrev, reservasLink, reservasLinkPrev }));
  } catch (e) { console.error("[novedades] generales:", e); }

  // ---- cancelaciones hechas desde una cuenta del equipo (migración 138; sin ella no hay aviso) ----
  try {
    const { data, error } = await sb.from("appointments").select("cancelled_by_user").eq("tenant_id", tenantId).eq("status", "cancelled").gte("date", desde).lte("date", hoy).not("cancelled_by_user", "is", null).limit(5000);
    if (!error) {
      const cuenta = new Map<string, number>();
      for (const r of (data as any[]) || []) cuenta.set(r.cancelled_by_user, (cuenta.get(r.cancelled_by_user) || 0) + 1);
      novedades.push(...novedadesCancelacionesCuenta(Array.from(cuenta.entries()).map(([id, n]) => ({ id, nombre: nombres.get(id) || "Una cuenta del equipo", n }))));
    }
  } catch (e) { console.error("[novedades] cancelaciones por cuenta:", e); }

  // ---- última campaña de Retención: quiénes volvieron y por qué vía ----
  try { novedades.push(...novedadCampana(await campanaReciente(sb, tenantId, hoy))); } catch (e) { console.error("[novedades] campaña:", e); }

  // ---- alertas ----
  try {
    const { count } = await sb.from("booking_deposits").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "needs_refund");
    novedades.push(...novedadesAlertas({ abonosPorDevolver: count || 0 }));
  } catch { /* sin abonos */ }

  return NextResponse.json({ semana: lunesDe(hoy), novedades: ordenarNovedades(novedades) });
}

async function campanaReciente(sb: any, tenantId: string, hoy: string): Promise<Campana | null> {
  const { data: c } = await sb.from("retention_campaigns").select("id, name, created_at, coupon_code, sent_count")
    .eq("tenant_id", tenantId).gt("sent_count", 0).gte("created_at", chileDayBoundsUtc(dateStrOffset(hoy, -45)).startUtc).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!c) return null;
  const { data: rec } = await sb.from("retention_campaign_recipients").select("client_id, contact").eq("campaign_id", c.id).eq("status", "sent").limit(5000);
  let ids = Array.from(new Set(((rec as any[]) || []).map((r) => r.client_id).filter(Boolean))) as string[];
  // Campañas antiguas sin cliente guardado: se busca por el correo al que se envió.
  if (ids.length === 0) {
    const correos = Array.from(new Set(((rec as any[]) || []).map((r) => String(r.contact || "").trim().toLowerCase()).filter((x) => x.includes("@"))));
    for (const lote of trozos(correos, 150)) { const { data } = await sb.from("clients").select("id").eq("tenant_id", tenantId).in("email", lote); ids.push(...((data as any[]) || []).map((x) => x.id)); }
    ids = Array.from(new Set(ids));
  }
  if (ids.length === 0) return null;
  const citas: { client_id: string; source: string | null }[] = [];
  for (const lote of trozos(ids, 150)) {
    const { data } = await sb.from("appointments").select("client_id, source").eq("tenant_id", tenantId).in("client_id", lote).gt("created_at", c.created_at).neq("status", "cancelled");
    citas.push(...((data as any[]) || []));
  }
  const volvieron = new Set(citas.map((x) => x.client_id));
  const porLink = new Set(citas.filter((x) => x.source === "link").map((x) => x.client_id));
  // Cupón de la campaña usado en una venta después del envío.
  const usaronCupon = new Set<string>();
  if (c.coupon_code) {
    const { data: cup } = await sb.from("coupons").select("id").eq("tenant_id", tenantId).eq("code", c.coupon_code);
    const cuponIds = ((cup as any[]) || []).map((x) => x.id);
    if (cuponIds.length) for (const lote of trozos(ids, 150)) {
      const { data } = await sb.from("transactions").select("client_id").eq("tenant_id", tenantId).eq("status", "completed").in("client_id", lote).in("coupon_id", cuponIds).gt("created_at", c.created_at);
      for (const t of (data as any[]) || []) usaronCupon.add(t.client_id);
    }
  }
  const dias = Math.floor((Date.parse(chileDayBoundsUtc(hoy).startUtc) - Date.parse(c.created_at)) / 86400000);
  return {
    nombre: c.name || "Campaña de Retención", enviadaHace: Math.max(0, dias), cupon: c.coupon_code || null, destinatarios: ids.length,
    volvieron: volvieron.size, porLink: porLink.size, usaronCupon: usaronCupon.size,
    cuponEnOtraVia: Array.from(usaronCupon).filter((id) => volvieron.has(id) && !porLink.has(id)).length,
  };
}
