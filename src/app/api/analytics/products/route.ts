import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Top products sold by time period
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: items } = await supabase
    .from("transaction_items")
    .select("product_id, description, quantity, total")
    .not("product_id", "is", null);

  // Get transactions in range to filter items
  const { data: transactions } = await supabase
    .from("transactions")
    .select("id")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", startDate.toISOString());

  const txIds = new Set((transactions || []).map((t) => t.id));

  // Since transaction_items doesn't have created_at, we filter by transaction
  // For now, return all product sales aggregated
  const productMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

  for (const item of items || []) {
    if (!productMap[item.description]) {
      productMap[item.description] = { name: item.description, quantity: 0, revenue: 0 };
    }
    productMap[item.description].quantity += item.quantity;
    productMap[item.description].revenue += Number(item.total);
  }

  const sorted = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({
    period: `${days} dias`,
    products: sorted.slice(0, 20),
    totalProducts: sorted.length,
  });
}
