import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { getTenantFromRequest } from "@/lib/tenant-filter";
import { todayInChile, chileDayBoundsUtc } from "@/lib/utils";

// Reads from the DB and must never be prerendered/baked at build time.
export const dynamic = "force-dynamic";

// Punto 17 (Pablo): mismo criterio que /api/reportes/monthly — agrupar por nombre
// normalizado para no listar dos veces a un profesional cuya cuenta fue recreada.
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

// Generates an HTML report that can be printed/saved as PDF
export async function GET(req: NextRequest) {
  // Owners/managers only — same gate as the monthly report JSON.
  const { role } = await getCurrentUserRoleAndTenant();
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const supabase = createAdminSupabase();
  const tenantId = await getTenantFromRequest(req);
  const { searchParams } = new URL(req.url);
  // Punto 1 (Nico): "mes actual" por defecto debe ser el mes calendario de Chile.
  const [chileYear, chileMonth] = todayInChile().split("-").map(Number);
  const month = parseInt(searchParams.get("month") || String(chileMonth));
  const year = parseInt(searchParams.get("year") || String(chileYear));

  // Scope every query to the caller's business. "ALL" means super_admin (no filter).
  const scoped = (q: any) => (tenantId && tenantId !== "ALL" ? q.eq("tenant_id", tenantId) : q);

  // Report header must reflect the caller's own business, not a hardcoded salon.
  let businessName = "re-booking";
  let businessAddress = "";
  if (tenantId && tenantId !== "ALL") {
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("name, address")
      .eq("id", tenantId)
      .single();
    if (tenantRow?.name) businessName = tenantRow.name;
    if (tenantRow?.address) businessAddress = tenantRow.address;
  }

  const firstDayStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const startDate = chileDayBoundsUtc(firstDayStr).startUtc;
  const endDate = chileDayBoundsUtc(lastDayStr).endUtc; // exclusive upper bound

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // Fetch data
  const { data: incomeTx } = await scoped(supabase
    .from("transactions")
    .select("total, payment_method, barber_id")
    .eq("type", "income").eq("status", "completed")
    .gte("created_at", startDate).lt("created_at", endDate));

  const { data: expenseTx } = await scoped(supabase
    .from("transactions")
    .select("id, total")
    .eq("type", "expense").eq("status", "completed")
    .gte("created_at", startDate).lt("created_at", endDate));

  const { count: appointmentsCompleted } = await scoped(supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("date", firstDayStr).lte("date", lastDayStr));

  const { count: newClients } = await scoped(supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startDate).lt("created_at", endDate));

  const totalIncome = (incomeTx || []).reduce((s: number, t: any) => s + Number(t.total), 0);
  const totalExpenses = (expenseTx || []).reduce((s: number, t: any) => s + Number(t.total), 0);
  const netProfit = totalIncome - totalExpenses;

  // Income by payment method
  const methodMap: Record<string, number> = {};
  for (const t of incomeTx || []) {
    methodMap[t.payment_method] = (methodMap[t.payment_method] || 0) + Number(t.total);
  }

  // Income by barber
  const barberMap: Record<string, number> = {};
  for (const t of incomeTx || []) {
    if (t.barber_id) barberMap[t.barber_id] = (barberMap[t.barber_id] || 0) + Number(t.total);
  }

  const barberIds = Object.keys(barberMap);
  let barberNames: Record<string, string> = {};
  if (barberIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", barberIds);
    barberNames = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));
  }

  // Punto 17: agrupar ventas e id's por nombre normalizado.
  const barberNameGroups: Record<string, { name: string; total: number; count: number }> = {};
  for (const [id, total] of Object.entries(barberMap)) {
    const name = barberNames[id] || "Desconocido";
    const key = normalizeName(name);
    if (!barberNameGroups[key]) barberNameGroups[key] = { name, total: 0, count: 0 };
    barberNameGroups[key].total += total;
    barberNameGroups[key].count += (incomeTx || []).filter((t: any) => t.barber_id === id).length;
  }

  // Punto 18: detalle de egresos manuales (electricidad, arriendo, sueldos, etc.).
  const expenseTxIds = (expenseTx || []).map((t: any) => t.id);
  const expenseMap: Record<string, number> = {};
  if (expenseTxIds.length > 0) {
    const { data: expenseItems } = await supabase
      .from("transaction_items")
      .select("description, total, transaction_id")
      .in("transaction_id", expenseTxIds);
    for (const item of expenseItems || []) {
      const label = item.description || "Otro egreso";
      expenseMap[label] = (expenseMap[label] || 0) + Number(item.total);
    }
  }

  const paymentLabels: Record<string, string> = {
    cash: "Efectivo", debit_card: "Debito", credit_card: "Credito", transfer: "Transferencia", mixed: "Mixto"
  };

  const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;

  // Build HTML
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cierre Mensual - ${monthNames[month-1]} ${year} - re-booking</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #e53e3e; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 24px; }
    .header .period { color: #666; font-size: 14px; }
    .brand { font-size: 28px; font-weight: 900; font-style: italic; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px; }
    .stat { background: #f8f8f8; border-radius: 8px; padding: 16px; text-align: center; }
    .stat .value { font-size: 24px; font-weight: 700; }
    .stat .label { font-size: 11px; color: #666; text-transform: uppercase; margin-top: 4px; }
    .stat.income .value { color: #16a34a; }
    .stat.expense .value { color: #dc2626; }
    .stat.profit .value { color: #2563eb; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 16px; font-weight: 700; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; background: #f3f3f3; font-weight: 600; }
    td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
    .text-right { text-align: right; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 11px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 30px; }
    .kpi { text-align: center; padding: 12px; background: #fafafa; border-radius: 6px; }
    .kpi .num { font-size: 20px; font-weight: 700; }
    .kpi .lbl { font-size: 10px; color: #888; text-transform: uppercase; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: right;">
    <button onclick="window.print()" style="padding: 10px 20px; background: #e53e3e; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
      Descargar PDF / Imprimir
    </button>
  </div>

  <div class="header">
    <div>
      <span class="brand">${businessName}</span>
      <p class="period">${monthNames[month-1]} ${year} · Cierre Mensual</p>
    </div>
    <div style="text-align: right; font-size: 12px; color: #888;">
      ${businessAddress ? `<p>${businessAddress}</p>` : ""}
      <p>Generado: ${new Date().toLocaleDateString("es-CL")}</p>
    </div>
  </div>

  <div class="stats">
    <div class="stat income">
      <div class="value">${fmt(totalIncome)}</div>
      <div class="label">Total Ingresos</div>
    </div>
    <div class="stat expense">
      <div class="value">${fmt(totalExpenses)}</div>
      <div class="label">Total Egresos</div>
    </div>
    <div class="stat profit">
      <div class="value">${fmt(netProfit)}</div>
      <div class="label">Utilidad Neta</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="num">${(incomeTx || []).length + (expenseTx || []).length}</div>
      <div class="lbl">Transacciones</div>
    </div>
    <div class="kpi">
      <div class="num">${appointmentsCompleted || 0}</div>
      <div class="lbl">Citas Completadas</div>
    </div>
    <div class="kpi">
      <div class="num">${newClients || 0}</div>
      <div class="lbl">Clientes Nuevos</div>
    </div>
    <div class="kpi">
      <div class="num">${(incomeTx || []).length > 0 ? fmt(Math.round(totalIncome / (incomeTx || []).length)) : "$0"}</div>
      <div class="lbl">Ticket Promedio</div>
    </div>
  </div>

  <div class="section">
    <h2>Ingresos por Barbero</h2>
    <table>
      <thead><tr><th>Barbero</th><th class="text-right">Ventas</th><th class="text-right">Total</th></tr></thead>
      <tbody>
        ${Object.values(barberNameGroups).map(({ name, count, total }) => `
          <tr><td>${name}</td><td class="text-right">${count}</td><td class="text-right">${fmt(total)}</td></tr>
        `).join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Ingresos por Metodo de Pago</h2>
    <table>
      <thead><tr><th>Metodo</th><th class="text-right">Total</th></tr></thead>
      <tbody>
        ${Object.entries(methodMap).map(([method, total]) => `
          <tr><td>${paymentLabels[method] || method}</td><td class="text-right">${fmt(total)}</td></tr>
        `).join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Detalle de Egresos</h2>
    <table>
      <thead><tr><th>Concepto</th><th class="text-right">Total</th></tr></thead>
      <tbody>
        ${Object.keys(expenseMap).length > 0 ? Object.entries(expenseMap).map(([name, total]) => `
          <tr><td>${name}</td><td class="text-right">${fmt(total)}</td></tr>
        `).join("") : `<tr><td colspan="2" style="text-align:center;color:#999;">Sin egresos manuales en este periodo</td></tr>`}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>${businessName} · Cierre Mensual ${monthNames[month-1]} ${year}</p>
    <p>Documento generado automaticamente · re-booking.cl</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
