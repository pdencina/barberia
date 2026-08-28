import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getTenantFromRequest } from "@/lib/tenant-filter";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const tenantId = await getTenantFromRequest(req);
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const barberId = searchParams.get("barberId");

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

  // "ALL" means super_admin (no filter, sees every business).
  if (tenantId && tenantId !== "ALL") query = query.eq("tenant_id", tenantId);
  if (type && type !== "ALL") query = query.eq("type", type.toLowerCase());
  if (from) query = query.gte("created_at", new Date(from).toISOString());
  if (to) {
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);
    query = query.lte("created_at", toDate.toISOString());
  }
  if (barberId) query = query.eq("barber_id", barberId);

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
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { type, description, amount, paymentMethod, notes, tenantId: bodyTenantId } = body;

  // Resolve tenant: prefer explicit param, fallback to session. Never save a manual
  // income/expense entry without a business, or it becomes invisible in Finanzas.
  let resolvedTenantId = bodyTenantId;
  if (!resolvedTenantId) {
    const resolved = await getTenantFromRequest(req);
    resolvedTenantId = resolved && resolved !== "ALL" ? resolved : null;
  }
  if (!resolvedTenantId) {
    return NextResponse.json({ error: "No se pudo determinar el negocio para la transaccion." }, { status: 400 });
  }

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      type: type.toLowerCase(),
      status: "completed",
      subtotal: amount,
      total: amount,
      payment_method: paymentMethod.toLowerCase(),
      notes,
      tenant_id: resolvedTenantId,
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
