import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getTenantFromRequest } from "@/lib/tenant-filter";

// GET: Top products sold by time period (scoped to the caller's business)
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const tenantId = await getTenantFromRequest(req);
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get transactions in range, scoped to tenant, to know which items to include.
  let txQuery = supabase
    .from("transactions")
    .select("id")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", startDate.toISOString());
  if (tenantId && tenantId !== "ALL") txQuery = txQuery.eq("tenant_id", tenantId);
  const { data: transactions } = await txQuery;

  const txIds = (transactions || []).map((t) => t.id);

  // transaction_items has no tenant_id or created_at of its own — scope it through the
  // tenant + date filtered transaction ids above (was previously ignoring both filters
  // and aggregating every business's product sales together, for all time).
  const { data: items } = txIds.length > 0
    ? await supabase
        .from("transaction_items")
        .select("product_id, description, quantity, total, transaction_id")
        .not("product_id", "is", null)
        .in("transaction_id", txIds)
    : { data: [] as Array<{ description: string; quantity: number; total: number }> };

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
