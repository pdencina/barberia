// Mensaje de retencion por WhatsApp. Lo usan el envio individual, la lista masiva y la vista previa de la pantalla de
// Retencion, para que lo que se ve ANTES de enviar sea exactamente lo que recibe el cliente.
export interface RetentionCoupon { code: string; description?: string | null; discount_type?: string | null; discount_value?: number | null }

export function couponDiscountText(c: RetentionCoupon | null | undefined): string {
  if (!c || c.discount_value == null) return "";
  return c.discount_type === "percentage" ? `${c.discount_value}% de descuento` : `$${Number(c.discount_value).toLocaleString("es-CL")} de descuento`;
}

export function buildRetentionWhatsApp(opts: { clientName?: string | null; message?: string | null; coupon?: RetentionCoupon | null; bookingUrl: string }): string {
  const first = (opts.clientName || "").trim().split(/\s+/)[0];
  let msg = (opts.message || "").trim() || `Hola${first ? ` ${first}` : ""}! Te extrañamos. Agenda tu próxima cita.`;
  if (opts.coupon) {
    const d = couponDiscountText(opts.coupon);
    msg += `\n\nTenemos un cupón para ti: ${opts.coupon.code}${d ? ` (${d})` : ""}`;
  }
  msg += `\n\nAgenda aquí: ${opts.bookingUrl}`;
  return msg;
}
