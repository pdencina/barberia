import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

  // Income transactions
  const { data: incomeTx } = await supabase
    .from("transactions")
    .select("total, payment_method, barber_id")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  // Expense transactions
  const { data: expenseTx } = await supabase
    .from("transactions")
    .select("total")
    .eq("type", "expense")
    .eq("status", "completed")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  const totalIncome = (incomeTx || []).reduce((s, t) => s + Number(t.total), 0);
  const totalExpenses = (expenseTx || []).reduce((s, t) => s + Number(t.total), 0);

  // Appointments completed
  const { count: appointmentsCompleted } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("date", startDate.split("T")[0])
    .lte("date", endDate.split("T")[0]);

  // New clients
  const { count: newClients } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  // Income by payment method
  const methodMap: Record<string, { total: number; count: number }> = {};
  for (const t of incomeTx || []) {
    const m = t.payment_method;
    if (!methodMap[m]) methodMap[m] = { total: 0, count: 0 };
    methodMap[m].total += Number(t.total);
    methodMap[m].count++;
  }

  // Income by barber
  const barberMap: Record<string, { total: number; count: number }> = {};
  for (const t of incomeTx || []) {
    if (!t.barber_id) continue;
    if (!barberMap[t.barber_id]) barberMap[t.barber_id] = { total: 0, count: 0 };
    barberMap[t.barber_id].total += Number(t.total);
    barberMap[t.barber_id].count++;
  }

  // Get barber names
  const barberIds = Object.keys(barberMap);
  let barberNames: Record<string, string> = {};
  if (barberIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", barberIds);
    barberNames = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));
  }

  // Top services (from transaction_items via transactions)
  const { data: serviceItems } = await supabase
    .from("transaction_items")
    .select("description, total, quantity, service_id, transaction_id")
    .not("service_id", "is", null);

  const svcMap: Record<string, { total: number; count: number }> = {};
  for (const item of serviceItems || []) {
    if (!svcMap[item.description]) svcMap[item.description] = { total: 0, count: 0 };
    svcMap[item.description].total += Number(item.total);
    svcMap[item.description].count += item.quantity;
  }

  // Top products
  const { data: productItems } = await supabase
    .from("transaction_items")
    .select("description, total, quantity, product_id, transaction_id")
    .not("product_id", "is", null);

  const prodMap: Record<string, { total: number; count: number }> = {};
  for (const item of productItems || []) {
    if (!prodMap[item.description]) prodMap[item.description] = { total: 0, count: 0 };
    prodMap[item.description].total += Number(item.total);
    prodMap[item.description].count += item.quantity;
  }

  return NextResponse.json({
    period: { month, year },
    summary: {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      totalTransactions: (incomeTx?.length || 0) + (expenseTx?.length || 0),
      appointmentsCompleted: appointmentsCompleted || 0,
      newClients: newClients || 0,
    },
    incomeByMethod: Object.entries(methodMap).map(([method, v]) => ({
      method, ...v,
    })),
    topServices: Object.entries(svcMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    topProducts: Object.entries(prodMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    incomeByBarber: Object.entries(barberMap).map(([id, v]) => ({
      name: barberNames[id] || "Desconocido", ...v,
    })),
  });
}
