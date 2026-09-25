import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest } from "@/lib/supabase/server";
import { todayInChile, chileDayBoundsUtc } from "@/lib/utils";

// Punto 1 (Nico): rango [startUtc, endUtc) de un mes calendario de Chile, para filtrar
// columnas timestamptz como created_at (evita el corrimiento de zona horaria que daba
// `new Date(year, month, 0, 23, 59, 59).toISOString()`).
function monthBoundsChile(year: number, month: number): { startUtc: string; endUtc: string } {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  return { startUtc: chileDayBoundsUtc(startDate).startUtc, endUtc: chileDayBoundsUtc(endDate).endUtc };
}

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  // SEGURIDAD: nunca confiar directo en el tenantId de la URL — resolveTenantForRequest lo
  // reemplaza por el negocio real del usuario logueado salvo que sea super_admin.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));
  const scoped = (q: any) => (tenantId && tenantId !== "ALL" ? q.eq("tenant_id", tenantId) : q);
  const [chileYear, chileMonth] = todayInChile().split("-").map(Number);
  const month = parseInt(searchParams.get("month") || String(chileMonth));
  const year = parseInt(searchParams.get("year") || String(chileYear));

  const { startUtc: startDate, endUtc: endDate } = monthBoundsChile(year, month);

  // Commission-mode barbers only. Rental ("arriendo") professionals pay a fixed chair
  // fee and don't earn commission, so they must not appear here. work_mode can be null
  // for older rows — treat null as commission (the default).
  const { data: barbers } = await scoped(supabase
    .from("profiles")
    .select("id, name, commission_rate, work_mode")
    .eq("role", "barber")
    .eq("active", true)
    .or("work_mode.eq.commission,work_mode.is.null")
    .order("name"));

  // Get income transactions per barber for this month
  const { data: transactions } = await scoped(supabase
    .from("transactions")
    .select("barber_id, total")
    .eq("type", "income")
    .eq("status", "completed")
    .not("barber_id", "is", null)
    .gte("created_at", startDate)
    .lt("created_at", endDate));

  // Get already paid commissions
  const { data: paidCommissions } = await scoped(supabase
    .from("commissions")
    .select("barber_id, commission_amount, paid")
    .gte("created_at", startDate)
    .lt("created_at", endDate));

  // Calculate per barber
  const barberStats = (barbers || []).map((barber: any) => {
    const barberTx = (transactions || []).filter((t: any) => t.barber_id === barber.id);
    const totalSales = barberTx.reduce((sum: number, t: any) => sum + Number(t.total), 0);
    const rate = Number(barber.commission_rate) || 40;
    const commissionAmount = Math.round(totalSales * rate / 100);

    const paidTotal = (paidCommissions || [])
      .filter((c: any) => c.barber_id === barber.id && c.paid)
      .reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0);

    return {
      barberId: barber.id,
      barberName: barber.name,
      commissionRate: rate,
      totalSales,
      commissionAmount,
      paidAmount: paidTotal,
      pendingAmount: commissionAmount - paidTotal,
      transactionCount: barberTx.length,
    };
  });

  const totals = {
    totalSales: barberStats.reduce((s: number, b: any) => s + b.totalSales, 0),
    totalCommissions: barberStats.reduce((s: number, b: any) => s + b.commissionAmount, 0),
    totalPaid: barberStats.reduce((s: number, b: any) => s + b.paidAmount, 0),
    totalPending: barberStats.reduce((s: number, b: any) => s + b.pendingAmount, 0),
  };

  return NextResponse.json({ barbers: barberStats, totals, period: { month, year } });
}

// Update commission rate for a barber
export async function PATCH(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { barberId, commissionRate } = body;

  const { error } = await supabase
    .from("profiles")
    .update({ commission_rate: commissionRate })
    .eq("id", barberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// Mark commissions as paid
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { barberId, amount, month, year } = body;

  const { startUtc: startDate, endUtc: endDate } = monthBoundsChile(year, month);

  // Get transactions for this barber this month
  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, total, tenant_id")
    .eq("type", "income")
    .eq("status", "completed")
    .eq("barber_id", barberId)
    .gte("created_at", startDate)
    .lt("created_at", endDate);

  // Get barber rate
  const { data: barber } = await supabase
    .from("profiles")
    .select("commission_rate, tenant_id")
    .eq("id", barberId)
    .single();

  const rate = Number(barber?.commission_rate) || 40;

  // Create commission records (tenant_id from the barber's business)
  for (const tx of transactions || []) {
    const commAmount = Math.round(Number(tx.total) * rate / 100);
    await supabase.from("commissions").upsert({
      barber_id: barberId,
      transaction_id: tx.id,
      sale_total: Number(tx.total),
      commission_rate: rate,
      commission_amount: commAmount,
      paid: true,
      paid_at: new Date().toISOString(),
      tenant_id: barber?.tenant_id || tx.tenant_id || null,
    }, { onConflict: "transaction_id" }).select();
  }

  return NextResponse.json({ success: true, paid: amount });
}
