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

  let txQuery = supabase
    .from("transactions")
    .select("id, type, total, payment_method, notes, created_at")
    .eq("status", "completed")
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd)
    .order("created_at", { ascending: true });
  if (tenantId && tenantId !== "ALL") txQuery = txQuery.eq("tenant_id", tenantId);
  const { data: transactions } = await txQuery;

  // Calculate cash movements
  const cashIncome = (transactions || [])
    .filter((t) => t.type === "income" && t.payment_method === "cash")
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
    .select("type, total, payment_method")
    .eq("status", "completed")
    .eq("tenant_id", tenantId)
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  const cashIncome = (transactions || [])
    .filter((t) => t.type === "income" && t.payment_method === "cash")
    .reduce((sum, t) => sum + Number(t.total), 0);

  const cashExpense = (transactions || [])
    .filter((t) => t.type === "expense" && t.payment_method === "cash")
    .reduce((sum, t) => sum + Number(t.total), 0);

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
