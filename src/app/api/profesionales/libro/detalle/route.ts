import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, isManagerLevel, resolveTenantForRequest } from "@/lib/supabase/server";
import { todayInChile, chileDayBoundsUtc } from "@/lib/utils";
import { fetchAllRows, monthEnd } from "@/lib/accounting";
import type { ProMode } from "@/lib/ledger";
import { productCommission, isCosmeticCategory, type ProductRule } from "@/lib/product-commission";

export const dynamic = "force-dynamic";

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const fechaChile = (iso: string) => {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return f.replace(",", "");
};

// Detalle de TODAS las ventas del mes de cada profesional: de donde sale lo que se le paga (servicios, productos, propinas).
// Solo lectura. Admin y recepcion, y solo del negocio de la sesion (nunca de un tenantId del navegador).
export async function GET(req: NextRequest) {
  const { ok } = await isManagerLevel();
  if (!ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const { tenantId, denied } = await resolveTenantForRequest(searchParams.get("tenantId"));
  if (denied || !tenantId || tenantId === "ALL") return NextResponse.json({ error: "Elige un negocio" }, { status: 400 });

  const mode: ProMode = searchParams.get("mode") === "rental" ? "rental" : "commission";
  const [cy, cm] = todayInChile().split("-").map(Number);
  const month = Math.min(12, Math.max(1, parseInt(searchParams.get("month") || String(cm)) || cm));
  const year = parseInt(searchParams.get("year") || String(cy)) || cy;
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const startUtc = chileDayBoundsUtc(first).startUtc;
  const endUtc = chileDayBoundsUtc(monthEnd(first)).endUtc;

  // Mismos profesionales que la pantalla (por modalidad), solo de este negocio.
  let pq = supabase.from("profiles").select("id, name, commission_rate")
    .eq("tenant_id", tenantId).eq("role", "barber").eq("active", true).order("name");
  pq = mode === "rental" ? pq.eq("work_mode", "rental") : pq.or("work_mode.eq.commission,work_mode.is.null");
  const { data: pros } = await pq;
  if (!pros || pros.length === 0) return NextResponse.json({ period: { month, year }, mode, pros: [] });
  const ids: string[] = pros.map((p: any) => p.id);

  let txs: any[] = [];
  try {
    txs = await fetchAllRows<any>(() =>
      supabase.from("transactions").select("id, barber_id, client_id, total, tip_amount, payment_method, notes, created_at")
        .eq("tenant_id", tenantId).eq("type", "income").eq("status", "completed")
        .in("barber_id", ids).gte("created_at", startUtc).lt("created_at", endUtc));
  } catch { return NextResponse.json({ error: "No pude leer las ventas" }, { status: 500 }); }
  // Los "[AJUSTE MANUAL]" antiguos viven ahora en el libro, igual que en el calculo del mes.
  txs = txs.filter((t) => !String(t.notes || "").startsWith("[AJUSTE MANUAL]"));

  const txIds = txs.map((t) => t.id);
  const itemRows: any[] = (await Promise.all(chunk(txIds, 200).map(async (c) => (await supabase.from("transaction_items").select("transaction_id, product_id, service_id, description, quantity, total").in("transaction_id", c)).data || []))).flat();
  const prodIds = Array.from(new Set(itemRows.map((i) => i.product_id).filter(Boolean))) as string[];
  const rule = new Map<string, ProductRule>();
  for (const c of chunk(prodIds, 200)) {
    let { data, error }: { data: any[] | null; error: any } = await supabase.from("products").select("id, category, sales_commission_type, sales_commission_value").in("id", c);
    if (error) ({ data } = await supabase.from("products").select("id").in("id", c));
    for (const p of data || []) rule.set(p.id, { category: p.category, type: p.sales_commission_type, value: Number(p.sales_commission_value) || 0 });
  }
  const clientIds = Array.from(new Set(txs.map((t) => t.client_id).filter(Boolean))) as string[];
  const clientName = new Map<string, string>();
  for (const c of chunk(clientIds, 200)) {
    const { data } = await supabase.from("clients").select("id, name").eq("tenant_id", tenantId).in("id", c);
    for (const p of data || []) clientName.set(p.id, p.name);
  }

  const itemsByTx = new Map<string, any[]>();
  for (const it of itemRows) itemsByTx.set(it.transaction_id, [...(itemsByTx.get(it.transaction_id) || []), it]);

  const out = pros.map((p: any) => {
    const rate = Number(p.commission_rate) || 40;
    let servicios = 0, productos = 0, propinas = 0, comProd = 0;
    const ventas = txs.filter((t) => t.barber_id === p.id).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).map((t) => {
      const its = (itemsByTx.get(t.id) || []).map((it) => {
        const total = Number(it.total) || 0;
        const esProducto = !!it.product_id;
        const r = esProducto ? rule.get(it.product_id) : undefined;
        const com = esProducto ? productCommission(r, Number(it.quantity) || 1, total) : 0;
        return { nombre: String(it.description || (esProducto ? "Producto" : "Servicio")), tipo: esProducto ? "producto" : "servicio", cantidad: Number(it.quantity) || 1, total, comisionProducto: Math.round(com), cosmetico: esProducto && isCosmeticCategory(r?.category) };
      });
      const prod = its.filter((i) => i.tipo === "producto").reduce((s, i) => s + i.total, 0);
      const svc = Math.max(0, Number(t.total) - prod);
      const tip = Number(t.tip_amount) || 0;
      const cp = its.reduce((s, i) => s + i.comisionProducto, 0);
      servicios += svc; productos += prod; propinas += tip; comProd += cp;
      return {
        id: t.id, fecha: fechaChile(t.created_at), cliente: t.client_id ? clientName.get(t.client_id) || "—" : "—",
        medio: String(t.payment_method || ""), total: Number(t.total) || 0, servicios: svc, productos: prod, propina: tip, comisionProductos: cp, items: its,
      };
    });
    return {
      barberId: p.id, name: p.name, rate,
      resumen: {
        ventas: ventas.length, servicios: Math.round(servicios), productos: Math.round(productos), propinas: Math.round(propinas),
        comisionServicios: mode === "commission" ? Math.round((Math.round(servicios) * rate) / 100) : null, comisionProductos: Math.round(comProd),
      },
      ventas,
    };
  });
  return NextResponse.json({ period: { month, year }, mode, pros: out });
}
