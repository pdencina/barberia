import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const amount = parseFloat(searchParams.get("amount") || "0");

  if (!code) return NextResponse.json({ valid: false, message: "Codigo requerido" });

  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  if (!coupon) return NextResponse.json({ valid: false, message: "Cupon no encontrado" });
  if (!coupon.active) return NextResponse.json({ valid: false, message: "Cupon inactivo" });
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
    return NextResponse.json({ valid: false, message: "Cupon agotado" });
  }
  if (coupon.valid_until && new Date() > new Date(coupon.valid_until)) {
    return NextResponse.json({ valid: false, message: "Cupon expirado" });
  }
  if (coupon.min_purchase && amount < Number(coupon.min_purchase)) {
    return NextResponse.json({ valid: false, message: `Compra minima: $${Number(coupon.min_purchase).toLocaleString("es-CL")}` });
  }

  let discount = 0;
  if (coupon.discount_type === "percentage") {
    discount = Math.round((amount * Number(coupon.discount_value)) / 100);
  } else {
    discount = Number(coupon.discount_value);
  }

  return NextResponse.json({ valid: true, discount, couponId: coupon.id });
}
