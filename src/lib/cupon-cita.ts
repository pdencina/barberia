// Descuento del código con el que se reservó una cita (appointments.coupon_id, migración 182). Se calcula en el servidor.
// El vencimiento y los usos se revisaron al reservar; aquí solo se comprueba que la cita siga cumpliendo las reglas
// (por si la cambiaron de profesional, día u hora).
import { computeCouponDiscount } from "@/lib/coupon";
import { horaDeCita, motivoCuponNoValido } from "@/lib/cupon-reglas";
import { pagoNoPermitido } from "@/lib/cupon-pagos";

export interface CuponDeCita { couponId: string; code: string; discount: number; description: string | null; pagos: string[] }

export async function cuponDeCita(sb: any, appointmentId: string, totalServicios: number): Promise<CuponDeCita | null> {
  const { data: a, error } = await sb.from("appointments").select("coupon_id, barber_id, date, start_time, tenant_id").eq("id", appointmentId).maybeSingle();
  if (error || !a?.coupon_id) return null; // sin la migración 182 o sin código
  const { data: c } = await sb.from("coupons").select("*").eq("id", a.coupon_id).eq("tenant_id", a.tenant_id).maybeSingle();
  if (!c) return null;
  if (motivoCuponNoValido({ conditions: c.conditions }, { barberId: a.barber_id, fecha: a.date, hora: horaDeCita(a.start_time) })) return null;
  const discount = Math.max(0, Math.min(Math.round(totalServicios), computeCouponDiscount(c, totalServicios)));
  return { couponId: c.id, code: c.code, discount, description: c.description || null, pagos: c.conditions?.pagos || [] };
}

/** Mensaje si alguna de esas citas se reservó con una promoción que no permite ese medio de pago. */
export async function bloqueoPorPromo(sb: any, appointmentIds: string[], metodos: string[]): Promise<string | null> {
  for (const id of appointmentIds) {
    const c = await cuponDeCita(sb, id, 1_000_000); // el monto no importa para el medio de pago
    const m = c ? pagoNoPermitido(c.pagos, metodos) : null;
    if (m) return m;
  }
  return null;
}
