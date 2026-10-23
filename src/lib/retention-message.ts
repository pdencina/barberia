// Mensaje de retencion por WhatsApp. Lo usan el envio individual, la lista masiva y la vista previa de la pantalla de
// Retencion, para que lo que se ve ANTES de enviar sea exactamente lo que recibe el cliente.
import { couponKind } from "@/lib/coupon";
export interface RetentionCoupon { code: string; description?: string | null; discount_type?: string | null; discount_value?: number | null }

// Texto del descuento ("$1.000 de descuento", "20% de descuento"). Un cupon SIN MONTO (solo codigo y texto) no tiene: devuelve "".
export function couponDiscountText(c: RetentionCoupon | null | undefined): string {
  const kind = couponKind(c);
  if (!c || kind === "none") return "";
  return kind === "percentage" ? `${c.discount_value}% de descuento` : `$${Number(c.discount_value).toLocaleString("es-CL")} de descuento`;
}

// Primer nombre para el saludo. Un marcador entre corchetes ("[nombre del cliente]", de la vista previa) se usa completo.
export function greetingName(clientName?: string | null): string {
  const n = (clientName || "").trim();
  return /^\[.*\]$/.test(n) ? n : n.split(/\s+/)[0];
}

export function buildRetentionWhatsApp(opts: { clientName?: string | null; message?: string | null; coupon?: RetentionCoupon | null; bookingUrl: string }): string {
  const first = greetingName(opts.clientName);
  let msg = (opts.message || "").trim() || `Hola${first ? ` ${first}` : ""}! Te extrañamos. Agenda tu próxima cita.`;
  if (opts.coupon) {
    const d = couponDiscountText(opts.coupon);
    msg += `\n\nTenemos un cupón para ti: ${opts.coupon.code}${d ? ` (${d})` : ""}`;
    // Sin monto, lo que vende es el texto del cupon ("Muestra este cupon en recepcion y no pagas las cejas!"): va en el mensaje.
    const desc = (opts.coupon.description || "").trim();
    if (!d && desc) msg += `\n${desc}`;
  }
  msg += `\n\nAgenda aquí: ${opts.bookingUrl}`;
  return msg;
}
