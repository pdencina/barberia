import { cuponVencido, horaDeCita, motivoCuponNoValido } from "@/lib/cupon-reglas";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireRole } from "@/lib/supabase/server";
import { computeCouponDiscount, couponKind } from "@/lib/coupon";

export async function GET(req: NextRequest) {
  // SEGURIDAD: sin sesion cualquiera podia llamar esto (consulta cupones de descuento).
  const guard = await requireRole(["admin", "super_admin", "receptionist", "barber"]);
  if (!guard.ok) return guard.response;
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const amount = parseFloat(searchParams.get("amount") || "0");

  if (!code) return NextResponse.json({ valid: false, message: "Codigo requerido" });

  let q = supabase.from("coupons").select("*").eq("code", code.toUpperCase());
  if (guard.role !== "super_admin") q = q.eq("tenant_id", guard.tenantId);
  const { data: coupon } = await q.maybeSingle();

  if (!coupon) return NextResponse.json({ valid: false, message: "Cupon no encontrado" });
  if (!coupon.active) return NextResponse.json({ valid: false, message: "Cupon inactivo" });
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
    return NextResponse.json({ valid: false, message: "Cupon agotado" });
  }
  if (cuponVencido(coupon.valid_until)) {
    return NextResponse.json({ valid: false, message: "Cupon expirado" });
  }
  if (coupon.min_purchase && amount < Number(coupon.min_purchase)) {
    return NextResponse.json({ valid: false, message: `Compra minima: $${Number(coupon.min_purchase).toLocaleString("es-CL")}` });
  }

  // Reglas del cupón (profesional, fechas y horario de la atención). Con cita se usa su día y hora; sin cita, ahora en Chile.
  const barberId = searchParams.get("barberId") || "";
  const apptId = searchParams.get("appointmentId") || "";
  if (coupon.conditions && barberId) {
    const ahora = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" }).format(new Date());
    let fecha = ahora.slice(0, 10), hora = ahora.slice(11, 16);
    if (apptId) {
      const { data: a } = await supabase.from("appointments").select("date, start_time").eq("id", apptId).eq("tenant_id", coupon.tenant_id).maybeSingle();
      if (a) { fecha = a.date; hora = horaDeCita(a.start_time); }
    }
    // El vencimiento y el uso ya se revisaron arriba; aquí interesan las reglas.
    const motivo = motivoCuponNoValido({ conditions: coupon.conditions }, { barberId, fecha, hora });
    if (motivo) return NextResponse.json({ valid: false, message: motivo });
  }

  const discount = computeCouponDiscount(coupon, amount);

  // noDiscount: cupon sin monto (solo codigo y texto, p. ej. "cejas gratis"): es valido pero no descuenta dinero; el POS muestra
  // su descripcion para que quien cobra aplique el beneficio.
  const noDiscount = couponKind(coupon) === "none";
  return NextResponse.json({ valid: true, discount, couponId: coupon.id, noDiscount, description: noDiscount ? coupon.description || null : undefined });
}
