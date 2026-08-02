import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// Generates an HTML report that can be printed/saved as PDF
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // Fetch data
  const { data: incomeTx } = await supabase
    .from("transactions")
    .select("total, payment_method, barber_id")
    .eq("type", "income").eq("status", "completed")
    .gte("created_at", startDate).lte("created_at", endDate);

  const { data: expenseTx } = await supabase
    .from("transactions")
    .select("total")
    .eq("type", "expense").eq("status", "completed")
    .gte("created_at", startDate).lte("created_at", endDate);

  const { count: appointmentsCompleted } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("date", startDate.split("T")[0]).lte("date", endDate.split("T")[0]);

  const { count: newClients } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startDate).lte("created_at", endDate);

  const totalIncome = (incomeTx || []).reduce((s, t) => s + Number(t.total), 0);
  const totalExpenses = (expenseTx || []).reduce((s, t) => s + Number(t.total), 0);
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
      <span class="brand">Estudio+Levels</span>
      <p class="period">${monthNames[month-1]} ${year} · Cierre Mensual</p>
    </div>
    <div style="text-align: right; font-size: 12px; color: #888;">
      <p>1889 Juan de Dios Malebran</p>
      <p>Puente Alto, Chile</p>
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
        ${Object.entries(barberMap).map(([id, total]) => `
          <tr><td>${barberNames[id] || "Desconocido"}</td><td class="text-right">${(incomeTx || []).filter(t => t.barber_id === id).length}</td><td class="text-right">${fmt(total)}</td></tr>
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

  <div class="footer">
    <p>re-booking · Cierre Mensual ${monthNames[month-1]} ${year}</p>
    <p>Documento generado automaticamente · rebooking.cl</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
