import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Current day's cash register status + transactions
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  // Get register for this date
  const { data: register } = await supabase
    .from("cash_register")
    .select("*, opened_by_profile:profiles!cash_register_opened_by_fkey(name), closed_by_profile:profiles!cash_register_closed_by_fkey(name)")
    .eq("date", date)
    .single();

  // Get today's cash transactions
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, type, total, payment_method, notes, created_at")
    .eq("status", "completed")
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd)
    .order("created_at", { ascending: true });

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
  const { openingAmount, userId } = body;

  const today = new Date().toISOString().split("T")[0];

  // Check if already open
  const { data: existing } = await supabase
    .from("cash_register")
    .select("id")
    .eq("date", today)
    .single();

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
  const { closingAmount, userId, notes } = body;

  const today = new Date().toISOString().split("T")[0];

  // Get current register
  const { data: register } = await supabase
    .from("cash_register")
    .select("*")
    .eq("date", today)
    .eq("status", "open")
    .single();

  if (!register) {
    return NextResponse.json({ error: "No hay caja abierta para hoy" }, { status: 404 });
  }

  // Calculate expected
  const dayStart = `${today}T00:00:00`;
  const dayEnd = `${today}T23:59:59`;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("type, total, payment_method")
    .eq("status", "completed")
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
