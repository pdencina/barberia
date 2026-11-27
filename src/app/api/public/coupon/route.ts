import { MENSAJE_DOS_PERSONAS } from "@/lib/promo-grupo";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { computeCouponDiscount } from "@/lib/coupon";
import { baseConDescuento, horaDeCita, motivoCuponNoValido } from "@/lib/cupon-reglas";
import { demasiadosIntentos, ipDe } from "@/lib/totem";

// Público (página de reservas): ¿el código sirve para esta cita? El negocio sale del profesional, nunca del navegador.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`cupon:${ipDe(req)}`, 20)) return NextResponse.json({ valid: false, message: "Muchos intentos. Espera un momento." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim().toUpperCase().slice(0, 40);
  const barberId = String(body.barberId || "");
  const startTime = String(body.startTime || "");
  if (!code || !barberId || !startTime) return NextResponse.json({ valid: false, message: "Escribe tu código" });
  const sb = createAdminSupabase();
  const { data: barber } = await sb.from("profiles").select("tenant_id").eq("id", barberId).maybeSingle();
  if (!barber?.tenant_id) return NextResponse.json({ valid: false, message: "Código no encontrado" });
  const { data: c } = await sb.from("coupons").select("*").eq("code", code).eq("tenant_id", barber.tenant_id).maybeSingle();
  if (!c) return NextResponse.json({ valid: false, message: "Código no encontrado" });
  const serviceIds: string[] = Array.isArray(body.serviceIds) ? body.serviceIds.map(String).slice(0, 20) : [];
  const motivo = motivoCuponNoValido(c, { barberId, fecha: startTime.slice(0, 10), hora: horaDeCita(startTime), serviceIds });
  if (motivo) return NextResponse.json({ valid: false, message: motivo });
  if (Number(c.conditions?.personas) === 2) return NextResponse.json({ valid: false, message: MENSAJE_DOS_PERSONAS });
  const total = Math.max(0, Number(body.total) || 0);
  let base = total;
  if (c.conditions?.servicioIds?.length) {
    const [{ data: s }, { data: propios }] = await Promise.all([
      sb.from("services").select("id, price").eq("tenant_id", barber.tenant_id).in("id", serviceIds),
      sb.from("barber_services").select("service_id, custom_price").eq("barber_id", barberId).in("service_id", serviceIds),
    ]);
    const precio = new Map((propios || []).map((x: any) => [x.service_id, Number(x.custom_price) || 0]));
    base = baseConDescuento(c.conditions, (s || []).map((x: any) => ({ id: x.id, price: precio.get(x.id) || Number(x.price) })), total);
  }
  return NextResponse.json({ valid: true, code: c.code, discount: Math.min(base, computeCouponDiscount(c, base)), description: c.description || null });
}
