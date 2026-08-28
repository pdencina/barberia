import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getTenantFromRequest } from "@/lib/tenant-filter";

// GET: Calculate rental summary for all rental-mode professionals
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const tenantId = await getTenantFromRequest(req);
  const scoped = (q: any) => (tenantId && tenantId !== "ALL" ? q.eq("tenant_id", tenantId) : q);
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  // Get all rental professionals (scoped to the caller's business)
  const { data: professionals } = await scoped(supabase
    .from("profiles")
    .select("id, name, work_mode, rental_daily_rate, rental_min_days, rental_max_days, rental_deductions, rental_notes")
    .eq("role", "barber")
    .eq("active", true)
    .eq("work_mode", "rental")
    .order("name"));

  if (!professionals || professionals.length === 0) {
    return NextResponse.json({ professionals: [], totals: { totalNet: 0, totalGross: 0 }, period: { month, year } });
  }

  // Get days worked per barber (distinct dates with completed appointments)
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0]; // last day of month

  const { data: appointments } = await scoped(supabase
    .from("appointments")
    .select("barber_id, date")
    .eq("status", "completed")
    .gte("date", startDate)
    .lte("date", endDate));

  const { data: transactions } = await scoped(supabase
    .from("transactions")
    .select("id, barber_id")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", `${startDate}T00:00:00`)
    .lte("created_at", `${endDate}T23:59:59`));

  // Map transactions to barber
  const txBarberMap = new Map<string, string>((transactions || []).map((t: any) => [t.id, t.barber_id]));

  // transaction_items has no tenant_id of its own — scope it via the tenant-filtered
  // transaction ids above (never query it unfiltered, or it mixes every business's sales).
  const txIds = (transactions || []).map((t: any) => t.id);
  const { data: productSales } = txIds.length > 0
    ? await supabase
        .from("transaction_items")
        .select("transaction_id, total")
        .not("product_id", "is", null)
        .in("transaction_id", txIds)
    : { data: [] as Array<{ transaction_id: string; total: number }> };

  // Calculate product sales per barber
  const productBonusByBarber: Record<string, number> = {};
  for (const item of productSales || []) {
    const barberId = txBarberMap.get(item.transaction_id);
    if (barberId) {
      productBonusByBarber[barberId] = (productBonusByBarber[barberId] || 0) + Number(item.total);
    }
  }

  // Count distinct days worked per barber
  const daysWorkedMap: Record<string, Set<string>> = {};
  for (const appt of appointments || []) {
    if (!daysWorkedMap[appt.barber_id]) daysWorkedMap[appt.barber_id] = new Set();
    daysWorkedMap[appt.barber_id].add(appt.date);
  }

  // Get existing rental records (if already saved)
  const { data: existingRecords } = await scoped(supabase
    .from("rental_records")
    .select("*")
    .eq("month", month)
    .eq("year", year));

  const recordMap = new Map((existingRecords || []).map((r: any) => [r.barber_id, r]));

  // Build summary per professional
  const summary = professionals.map((prof: any) => {
    const existing: any = recordMap.get(prof.id);
    const autoCalculatedDays = daysWorkedMap[prof.id]?.size || 0;
    const daysWorked = existing ? existing.days_worked : autoCalculatedDays;
    const dailyRate = Number(prof.rental_daily_rate) || 29000;
    const grossAmount = daysWorked * dailyRate;
    const deductions = existing ? Number(existing.deductions) : Number(prof.rental_deductions) || 0;
    const productBonus = Math.round((productBonusByBarber[prof.id] || 0) * 0.1); // 10% de productos vendidos como bono
    const netAmount = grossAmount - deductions + productBonus;

    return {
      id: prof.id,
      name: prof.name,
      dailyRate,
      daysWorked,
      autoCalculatedDays,
      grossAmount,
      deductions,
      productBonus,
      netAmount,
      paid: existing?.paid || false,
      paidAt: existing?.paid_at || null,
      notes: existing?.notes || prof.rental_notes || null,
      recordId: existing?.id || null,
    };
  });

  const totals = {
    totalGross: summary.reduce((s: number, p: any) => s + p.grossAmount, 0),
    totalNet: summary.reduce((s: number, p: any) => s + p.netAmount, 0),
    totalProfessionals: summary.length,
  };

  return NextResponse.json({ professionals: summary, totals, period: { month, year } });
}

// POST: Save/update rental record for a professional
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { barberId, month, year, daysWorked, deductions, productBonus, notes } = body;

  const { data: prof } = await supabase
    .from("profiles")
    .select("rental_daily_rate, tenant_id")
    .eq("id", barberId)
    .single();

  const dailyRate = Number(prof?.rental_daily_rate) || 29000;
  const grossAmount = daysWorked * dailyRate;
  const netAmount = grossAmount - (deductions || 0) + (productBonus || 0);

  const { data, error } = await supabase
    .from("rental_records")
    .upsert({
      barber_id: barberId,
      month,
      year,
      days_worked: daysWorked,
      daily_rate: dailyRate,
      gross_amount: grossAmount,
      deductions: deductions || 0,
      product_bonus: productBonus || 0,
      net_amount: netAmount,
      notes: notes || null,
      tenant_id: prof?.tenant_id || null,
    }, { onConflict: "barber_id,month,year" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH: Mark as paid
export async function PATCH(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { recordId, barberId, month, year } = await req.json();

  if (recordId) {
    await supabase.from("rental_records").update({ paid: true, paid_at: new Date().toISOString() }).eq("id", recordId);
  } else {
    // Create record and mark paid
    const { data: prof } = await supabase.from("profiles").select("rental_daily_rate, tenant_id").eq("id", barberId).single();
    const dailyRate = Number(prof?.rental_daily_rate) || 29000;
    await supabase.from("rental_records").upsert({
      barber_id: barberId, month, year, days_worked: 0, daily_rate: dailyRate,
      gross_amount: 0, deductions: 0, product_bonus: 0, net_amount: 0,
      paid: true, paid_at: new Date().toISOString(),
      tenant_id: prof?.tenant_id || null,
    }, { onConflict: "barber_id,month,year" });
  }

  return NextResponse.json({ success: true });
}
