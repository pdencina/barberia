// Por que Mercado Pago rechazo un pago, en palabras simples. Puro: se prueba sin base de datos.
// `detalle` es el status_detail de Mercado Pago (ej. cc_rejected_high_risk). Dos textos: uno para el cliente y uno para el administrador.
export interface MotivoRechazo { cliente: string; admin: string }

const TABLA: Record<string, MotivoRechazo> = {
  cc_rejected_insufficient_amount: { cliente: "La tarjeta no tiene saldo o cupo suficiente para el abono. Prueba con otra tarjeta o con otro medio de pago.", admin: "la tarjeta no tenía saldo o cupo suficiente" },
  cc_rejected_high_risk: { cliente: "Mercado Pago bloqueó el pago por seguridad. Esto pasa sobre todo después de varios intentos seguidos: no insistas con la misma tarjeta; prueba con otra o con otro medio de pago, o espera un rato.", admin: "Mercado Pago lo bloqueó por seguridad (suele pasar tras varios intentos seguidos con la misma tarjeta)" },
  cc_rejected_bad_filled_card_number: { cliente: "El número de la tarjeta está mal escrito. Revísalo e inténtalo de nuevo.", admin: "el número de tarjeta estaba mal escrito" },
  cc_rejected_bad_filled_date: { cliente: "La fecha de vencimiento de la tarjeta está mal escrita. Revísala e inténtalo de nuevo.", admin: "la fecha de vencimiento estaba mal escrita" },
  cc_rejected_bad_filled_security_code: { cliente: "El código de seguridad (CVV) de la tarjeta está mal escrito. Revísalo e inténtalo de nuevo.", admin: "el código de seguridad estaba mal escrito" },
  cc_rejected_bad_filled_other: { cliente: "Algún dato de la tarjeta está mal escrito. Revísalos e inténtalo de nuevo.", admin: "algún dato de la tarjeta estaba mal escrito" },
  cc_rejected_call_for_authorize: { cliente: "Tu banco necesita que autorices este pago. Llama a tu banco o prueba con otra tarjeta.", admin: "el banco pide autorizar el pago por teléfono" },
  cc_rejected_card_disabled: { cliente: "La tarjeta está desactivada para compras por internet. Actívala en tu banco o usa otra.", admin: "la tarjeta está desactivada para compras por internet" },
  cc_rejected_duplicated_payment: { cliente: "Ya hiciste un pago igual hace poco. Revisa si tu reserva quedó confirmada en tu correo.", admin: "pago duplicado" },
  cc_rejected_max_attempts: { cliente: "Llegaste al máximo de intentos con esa tarjeta. Usa otra tarjeta u otro medio de pago.", admin: "se llegó al máximo de intentos con esa tarjeta" },
  cc_rejected_blacklist: { cliente: "No pudimos procesar el pago con esa tarjeta. Usa otra tarjeta u otro medio de pago.", admin: "tarjeta rechazada por seguridad" },
  cc_rejected_card_error: { cliente: "No se pudo procesar la tarjeta. Inténtalo de nuevo o usa otra.", admin: "error al procesar la tarjeta" },
  cc_rejected_other_reason: { cliente: "Tu banco rechazó el pago sin dar más detalles. Prueba con otra tarjeta u otro medio de pago, o consulta a tu banco.", admin: "el banco rechazó el pago sin dar el motivo" },
};

export function motivoRechazo(detalle: string | null | undefined): MotivoRechazo {
  const d = String(detalle || "").replace(/^rejected:/, "").trim();
  return TABLA[d] || { cliente: "No pudimos procesar el pago. Prueba con otra tarjeta u otro medio de pago.", admin: d && d !== "sin_detalle" ? `Mercado Pago lo rechazó (${d})` : "Mercado Pago lo rechazó" };
}
