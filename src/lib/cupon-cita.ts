// Descuento del código con el que se reservó una cita (appointments.coupon_id, migración 182). Se calcula en el servidor.
// El vencimiento y los usos se revisaron al reservar; aquí solo se comprueba que la cita siga cumpliendo las reglas
// (por si la cambiaron de profesional, día u hora) y, en promociones de 2 personas, que siga habiendo acompañante.
import { computeCouponDiscount } from "@/lib/coupon";
import { baseConDescuento, horaDeCita, motivoCuponNoValido } from "@/lib/cupon-reglas";
import { pagoNoPermitido } from "@/lib/cupon-pagos";
import { tieneAcompanante } from "@/lib/promo-grupo";

export interface CuponDeCita { couponId: string; code: string; discount: number; description: string | null; pagos: string[]; dosPersonas: boolean }

// paraAviso: en el correo de la reserva la segunda persona puede no estar creada todavía; no se exige acompañante.
export async function cuponDeCita(sb: any, appointmentId: string, totalServicios: number, o: { paraAviso?: boolean } = {}): Promise<CuponDeCita | null> {
  const { data: a, error } = await sb.from("appointments").select("coupon_id, barber_id, date, start_time, tenant_id").eq("id", appointmentId).maybeSingle();
  if (error || !a?.coupon_id) return null; // sin la migración 182 o sin código
  const { data: c } = await sb.from("coupons").select("*").eq("id", a.coupon_id).eq("tenant_id", a.tenant_id).maybeSingle();
  if (!c) return null;
  const cumple = (x: any) => !motivoCuponNoValido({ conditions: c.conditions }, { barberId: x.barber_id, fecha: x.date, hora: horaDeCita(x.start_time) });
  if (!cumple(a)) return null;
  const dosPersonas = Number(c.conditions?.personas) === 2;
  if (dosPersonas && !o.paraAviso) {
    const { data: mia, error: eg } = await sb.from("appointments").select("coupon_group").eq("id", appointmentId).maybeSingle();
    if (eg || !mia?.coupon_group) return null;
    const { data: grupo } = await sb.from("appointments").select("id, date, status, barber_id, start_time, coupon_id").eq("tenant_id", a.tenant_id).eq("coupon_group", mia.coupon_group);
    const otros = (grupo || []).filter((g: any) => g.coupon_id === a.coupon_id).map((g: any) => ({ ...g, cumple: cumple(g) }));
    if (!tieneAcompanante({ id: appointmentId, date: a.date }, otros)) return null;
  }
  // Si la promoción es solo para algunos servicios, el descuento se calcula sobre ellos.
  let base = totalServicios;
  if (c.conditions?.servicioIds?.length) {
    const { data: lineas } = await sb.from("appointment_services").select("service_id, price").eq("appointment_id", appointmentId);
    base = baseConDescuento(c.conditions, (lineas || []).map((l: any) => ({ id: l.service_id, price: l.price })), totalServicios);
    if (base <= 0) return null;
  }
  const discount = Math.max(0, Math.min(Math.round(base), computeCouponDiscount(c, base)));
  return { couponId: c.id, code: c.code, discount, description: c.description || null, pagos: c.conditions?.pagos || [], dosPersonas };
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
