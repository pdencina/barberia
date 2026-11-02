import { productCommission, type ProductRule } from "@/lib/product-commission";

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// Para cada venta: cuanto fue de productos (no suma a la base del profesional) y cuanta comision de cosmeticos le corresponde.
export async function splitProductSales(supabase: any, txIds: string[]): Promise<Map<string, { productTotal: number; commission: number }>> {
  const out = new Map<string, { productTotal: number; commission: number }>();
  if (txIds.length === 0) return out;
  const items: any[] = (await Promise.all(chunk(txIds, 200).map(async (c) => (await supabase.from("transaction_items").select("transaction_id, product_id, quantity, total").in("transaction_id", c).not("product_id", "is", null)).data || []))).flat();
  const productIds = Array.from(new Set(items.map((i) => i.product_id))) as string[];
  const rules = new Map<string, ProductRule>();
  for (const c of chunk(productIds, 200)) {
    let { data, error }: { data: any[] | null; error: any } = await supabase.from("products").select("id, category, sales_commission_type, sales_commission_value").in("id", c);
    if (error) ({ data } = await supabase.from("products").select("id").in("id", c));
    for (const p of data || []) rules.set(p.id, { category: p.category, type: p.sales_commission_type, value: Number(p.sales_commission_value) || 0 });
  }
  for (const it of items) {
    const cur = out.get(it.transaction_id) || { productTotal: 0, commission: 0 };
    cur.productTotal += Number(it.total) || 0;
    cur.commission += productCommission(rules.get(it.product_id), Number(it.quantity) || 1, Number(it.total) || 0);
    out.set(it.transaction_id, cur);
  }
  return out;
}
