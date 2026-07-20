import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("transactions")
    .select(`
      *,
      client:clients(name),
      barber:profiles(name),
      items:transaction_items(description, total)
    `)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(100);

  if (type && type !== "ALL") query = query.eq("type", type.toLowerCase());
  if (from) query = query.gte("created_at", new Date(from).toISOString());
  if (to) {
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);
    query = query.lte("created_at", toDate.toISOString());
  }

  const { data: transactions, error } = await query;
  if (error) return NextResponse.json({ transactions: [], stats: { totalIncome: 0, totalExpenses: 0, balance: 0, transactionCount: 0 } });

  // Calculate stats
  const income = (transactions || []).filter((t) => t.type === "income");
  const expenses = (transactions || []).filter((t) => t.type === "expense");
  const totalIncome = income.reduce((s, t) => s + Number(t.total), 0);
  const totalExpenses = expenses.reduce((s, t) => s + Number(t.total), 0);

  return NextResponse.json({
    transactions: transactions || [],
    stats: {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      transactionCount: (transactions || []).length,
    },
  });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const body = await req.json();
  const { type, description, amount, paymentMethod, notes } = body;

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      type: type.toLowerCase(),
      status: "completed",
      subtotal: amount,
      total: amount,
      payment_method: paymentMethod.toLowerCase(),
      notes,
    })
    .select()
    .single();

  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

  await supabase.from("transaction_items").insert({
    transaction_id: tx.id,
    description,
    quantity: 1,
    unit_price: amount,
    total: amount,
  });

  return NextResponse.json(tx, { status: 201 });
}
