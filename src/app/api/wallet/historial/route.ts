import { NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";
import { isLedgerEnabled } from "@/lib/ledger";
import { splitProductSales } from "@/lib/product-split";
import { todayInChile } from "@/lib/utils";

export const dynamic = "force-dynamic";

const mesChile = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" }).format(new Date(iso)).slice(0, 7);
const sumarMeses = (ym: string, d: number) => { const [y, m] = ym.split("-").map(Number); const t = y * 12 + (m - 1) + d; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };

// Crecimiento de la propia persona (últimos 12 meses): lo que ganó, clientes atendidos y clientes nuevos (primera vez contigo).
// Solo muestra lo de quien tiene la sesión abierta; el profesional nunca llega por el navegador.
export async function GET() {
  const { userId, role } = await getCurrentUserRoleAndTenant();
  if (!userId || !role || role === "client") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sb = createAdminSupabase();
  try {
    const { data: me } = await sb.from("profiles").select("work_mode, commission_rate, tenant_id").eq("id", userId).maybeSingle();
    if (!me) return NextResponse.json({ meses: [], sinDatos: true });
    const hoy = todayInChile().slice(0, 7);
    const desde = sumarMeses(hoy, -11);
    // Todas las ventas de la persona (ligeras): sirven para el total por mes y para saber cuándo vino cada cliente por primera vez.
    const txs = await fetchAllRows<any>(() => sb.from("transactions").select("id, total, created_at, client_id")
      .eq("barber_id", userId).eq("type", "income").eq("status", "completed"));
    if (txs.length === 0) return NextResponse.json({ meses: [], sinDatos: true });

    const enVentana = txs.filter((t) => mesChile(t.created_at) >= desde);
    const modo = (me as any).work_mode || "commission";
    const rate = Number((me as any).commission_rate) || 40;
    const ledgerOn = await isLedgerEnabled(sb, (me as any).tenant_id || null).catch(() => false);
    const split = ledgerOn ? await splitProductSales(sb, enVentana.map((t) => t.id), (me as any).tenant_id).catch(() => new Map()) : new Map();

    // Primera vez de cada cliente con esta persona.
    const primera = new Map<string, string>();
    for (const t of txs) if (t.client_id) { const m = mesChile(t.created_at); if (!primera.has(t.client_id) || m < primera.get(t.client_id)!) primera.set(t.client_id, m); }

    const meses = Array.from({ length: 12 }, (_, i) => sumarMeses(desde, i));
    const filas = meses.map((mes) => {
      const delMes = enVentana.filter((t) => mesChile(t.created_at) === mes);
      let ganado = 0;
      if (modo === "commission") {
        let servicios = 0, cosmeticos = 0;
        for (const t of delMes) { const sp = split.get(t.id); servicios += Math.max(0, Number(t.total) - (sp?.productTotal || 0)); cosmeticos += sp?.commission || 0; }
        ganado = Math.round(servicios * (rate / 100)) + cosmeticos;
      } else ganado = delMes.reduce((s, t) => s + Number(t.total), 0);
      const clientes = new Set(delMes.filter((t) => t.client_id).map((t) => t.client_id as string));
      const nuevos = Array.from(clientes).filter((c) => primera.get(c) === mes).length;
      return { mes, ganado, atendidos: clientes.size, nuevos };
    });
    return NextResponse.json({ meses: filas, sinDatos: false });
  } catch (e) {
    console.error("[wallet/historial]", e);
    return NextResponse.json({ error: "No pude calcular tu crecimiento" }, { status: 500 });
  }
}
