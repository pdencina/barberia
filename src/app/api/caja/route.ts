import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getTenantFromRequest } from "@/lib/tenant-filter";

// GET: Current day's cash register status + transactions
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const tenantId = await getTenantFromRequest(req);
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  // Get register for this date, scoped to the caller's business. Without this, two
  // businesses opening a register on the same day would collide (see migration 053).
  let registerQuery = supabase
    .from("cash_register")
    .select("*, opened_by_profile:profiles!cash_register_opened_by_fkey(name), closed_by_profile:profiles!cash_register_closed_by_fkey(name)")
    .eq("date", date);
  if (tenantId && tenantId !== "ALL") registerQuery = registerQuery.eq("tenant_id", tenantId);
  const { data: register } = await registerQuery.maybeSingle();

  // Get today's cash transactions
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;

  // Enriched breakdown for the "Movimientos del dia" table: who did it (barber), what
  // (service/item descriptions), the tip, plus the amount/method/time. This is what
  // lets the daily cash count be reconciled inside re-booking instead of a side Excel.
  let txQuery = supabase
    .from("transactions")
    .select("id, type, total, payment_method, notes, created_at, tip_amount, barber_id, barber:profiles(name, work_mode, rental_cash_to_barber), items:transaction_items(description)")
    .eq("status", "completed")
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd)
    .order("created_at", { ascending: true });
  if (tenantId && tenantId !== "ALL") txQuery = txQuery.eq("tenant_id", tenantId);
  const { data: transactionsRaw } = await txQuery;

  // Flatten barber name + join item descriptions into a single "services" string.
  // `barberTakesCash` = a rental barber who pockets their own cash: their cash sales
  // never enter the salon's till, so they must be excluded from the expected cash count.
  const transactions = (transactionsRaw || []).map((t: any) => ({
    id: t.id,
    type: t.type,
    total: t.total,
    payment_method: t.payment_method,
    notes: t.notes,
    created_at: t.created_at,
    tip_amount: t.tip_amount || 0,
    barber_id: t.barber_id,
    barberName: t.barber?.name || null,
    barberTakesCash: t.barber?.work_mode === "rental" && !!t.barber?.rental_cash_to_barber,
    services: Array.isArray(t.items) ? t.items.map((i: any) => i.description).filter(Boolean).join(", ") : "",
  }));

  // Calculate cash movements. Exclude cash from rental barbers who take their own cash —
  // that money is theirs and never goes into the salon till, so counting it would make
  // the till look short every day.
  const cashIncome = (transactions || [])
    .filter((t) => t.type === "income" && t.payment_method === "cash" && !t.barberTakesCash)
    .reduce((sum, t) => sum + Number(t.total), 0);

  // Cash that a rental barber pocketed directly (informational — shown separately, NOT
  // part of the salon's expected till).
  const rentalCashToBarber = (transactions || [])
    .filter((t) => t.type === "income" && t.payment_method === "cash" && t.barberTakesCash)
    .reduce((sum, t) => sum + Number(t.total), 0);

  const cashExpense = (transactions || [])
    .filter((t) => t.type === "expense" && t.payment_method === "cash")
    .reduce((sum, t) => sum + Number(t.total), 0);

  const cardIncome = (transactions || [])
    .filter((t) => t.type === "income" && t.payment_method !== "cash")
    .reduce((sum, t) => sum + Number(t.total), 0);

  const totalIncome = (transactions || [])
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.total), 0);

  const totalExpense = (transactions || [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.total), 0);

  const openingAmount = register ? Number(register.opening_amount) : 0;
  const expectedCash = openingAmount + cashIncome - cashExpense;

  return NextResponse.json({
    register: register || null,
    isOpen: register?.status === "open",
    summary: {
      openingAmount,
      cashIncome,
      cashExpense,
      cardIncome,
      totalIncome,
      totalExpense,
      expectedCash,
      rentalCashToBarber, // cash pocketed by rental barbers, NOT in the salon till
      transactionCount: (transactions || []).length,
    },
    transactions: transactions || [],
  });
}

// POST: Open register
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { openingAmount, userId, tenantId: bodyTenantId } = body;

  // Resolve tenant: prefer explicit param, fallback to session.
  let tenantId: string | null = bodyTenantId || null;
  if (!tenantId) {
    const resolved = await getTenantFromRequest(req);
    tenantId = resolved && resolved !== "ALL" ? resolved : null;
  }
  if (!tenantId) {
    return NextResponse.json({ error: "No se pudo determinar el negocio para abrir la caja." }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Check if THIS business already opened a register today (was checking globally,
  // which blocked every other business from opening theirs — see migration 053).
  const { data: existing } = await supabase
    .from("cash_register")
    .select("id")
    .eq("date", today)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "La caja de hoy ya fue abierta" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("cash_register")
    .insert({
      date: today,
      opening_amount: openingAmount || 0,
      opened_by: userId || null,
      status: "open",
      tenant_id: tenantId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH: Close register
export async function PATCH(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { closingAmount, userId, notes, tenantId: bodyTenantId } = body;

  // Resolve tenant: prefer explicit param, fallback to session.
  let tenantId: string | null = bodyTenantId || null;
  if (!tenantId) {
    const resolved = await getTenantFromRequest(req);
    tenantId = resolved && resolved !== "ALL" ? resolved : null;
  }
  if (!tenantId) {
    return NextResponse.json({ error: "No se pudo determinar el negocio para cerrar la caja." }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Get THIS business's open register for today.
  const { data: register } = await supabase
    .from("cash_register")
    .select("*")
    .eq("date", today)
    .eq("status", "open")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!register) {
    return NextResponse.json({ error: "No hay caja abierta para hoy" }, { status: 404 });
  }

  // Calculate expected — only THIS business's transactions.
  const dayStart = `${today}T00:00:00`;
  const dayEnd = `${today}T23:59:59`;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("type, total, payment_method, barber:profiles(work_mode, rental_cash_to_barber)")
    .eq("status", "completed")
    .eq("tenant_id", tenantId)
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  // Same exclusion as the GET summary: cash pocketed directly by a rental barber never
  // entered the till, so it must not be part of the expected amount at close.
  const barberTakesCash = (t: any) => t.barber?.work_mode === "rental" && !!t.barber?.rental_cash_to_barber;

  const cashIncome = (transactions || [])
    .filter((t: any) => t.type === "income" && t.payment_method === "cash" && !barberTakesCash(t))
    .reduce((sum: number, t: any) => sum + Number(t.total), 0);

  const cashExpense = (transactions || [])
    .filter((t: any) => t.type === "expense" && t.payment_method === "cash")
    .reduce((sum: number, t: any) => sum + Number(t.total), 0);

  const expectedAmount = Number(register.opening_amount) + cashIncome - cashExpense;
  const difference = (closingAmount || 0) - expectedAmount;

  const { data, error } = await supabase
    .from("cash_register")
    .update({
      closing_amount: closingAmount,
      expected_amount: expectedAmount,
      difference,
      closed_by: userId || null,
      status: "closed",
      closed_at: new Date().toISOString(),
      notes: notes || null,
    })
    .eq("id", register.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
