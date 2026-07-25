import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Monthly comparison - last 6 months of income/expenses
export async function GET() {
  const supabase = createAdminSupabase();

  const months: Array<{ month: number; year: number; label: string; income: number; expenses: number }> = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    const { data: incomeTx } = await supabase
      .from("transactions")
      .select("total")
      .eq("type", "income").eq("status", "completed")
      .gte("created_at", startDate).lte("created_at", endDate);

    const { data: expenseTx } = await supabase
      .from("transactions")
      .select("total")
      .eq("type", "expense").eq("status", "completed")
      .gte("created_at", startDate).lte("created_at", endDate);

    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    months.push({
      month,
      year,
      label: `${monthNames[month - 1]} ${year}`,
      income: (incomeTx || []).reduce((s, t) => s + Number(t.total), 0),
      expenses: (expenseTx || []).reduce((s, t) => s + Number(t.total), 0),
    });
  }

  return NextResponse.json(months);
}
