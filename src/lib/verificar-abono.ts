// ¿La reserva con abono realmente quedo pagada y confirmada? Las pantallas de vuelta de Mercado Pago (success / pending / failure) NO prueban nada:
// cualquiera puede abrirlas, y Mercado Pago tambien manda al cliente a «success» en casos que no son un pago aprobado. Esta decision se toma con lo que
// SABE el servidor: la reserva en espera (booking_intents), el registro del pago (booking_deposits) y, si hace falta, el pago consultado a Mercado Pago.
// Puro: se prueba sin base de datos (scripts/test-verificar-abono.ts).
import { motivoRechazo } from "@/lib/motivo-rechazo";

export type EstadoAbono =
  | { estado: "pagado"; appointmentId: string | null }
  | { estado: "procesando" }                                   // Mercado Pago aprobo el pago pero la cita aun se esta creando
  | { estado: "esperando"; segundosRestantes: number }         // todavia no hay pago y sigue vigente el tiempo para pagar
  | { estado: "no_pagado"; motivo: string }                    // se rechazo, cancelo, vencio o no se pago: la reserva NO esta confirmada
  | { estado: "conflicto" }                                    // se pago pero el horario ya no estaba libre (se devuelve el abono)
  | { estado: "desconocido" };

export interface EntradaAbono {
  intent: { data: Record<string, any> | null; created_at: string } | null;
  deposito: { status: string; appointment_id: string | null } | null;   // fila de booking_deposits del pago, si se conoce
  pagoMp: { status: string; status_detail?: string | null; external_reference?: string | null } | null; // el pago consultado a Mercado Pago, si se pidio
  ref: string;
  ahora: number;
  segundosDeCobro: number;
  gracia?: number;
}

export function decidirEstadoAbono(e: EntradaAbono): EstadoAbono {
  const gracia = e.gracia ?? 45;
  const d = e.intent?.data || null;
  if (d?.resultado === "pagado") return { estado: "pagado", appointmentId: d.appointmentId || null };
  if (d?.resultado === "conflicto") return { estado: "conflicto" };
  if (!e.intent) return { estado: "desconocido" };

  const st = e.deposito?.status || "";
  if (st === "approved" && e.deposito?.appointment_id) return { estado: "pagado", appointmentId: e.deposito.appointment_id };
  if (st === "needs_refund") return { estado: "conflicto" };
  if (/^(rejected|cancelled|refunded|charged_back)/.test(st)) return { estado: "no_pagado", motivo: st.startsWith("rejected") ? motivoRechazo(st).cliente : "El pago no se completó." };

  // Un pago consultado a Mercado Pago solo vale si es de ESTA reserva (misma referencia).
  const mp = e.pagoMp && e.pagoMp.external_reference === e.ref ? e.pagoMp : null;
  if (mp) {
    if (mp.status === "approved") return { estado: "procesando" };
    if (mp.status === "rejected") return { estado: "no_pagado", motivo: motivoRechazo(mp.status_detail).cliente };
    if (mp.status === "cancelled" || mp.status === "refunded" || mp.status === "charged_back") return { estado: "no_pagado", motivo: "El pago no se completó." };
    // pending / in_process / authorized: se sigue esperando
  }

  const transcurrido = (e.ahora - new Date(e.intent.created_at).getTime()) / 1000;
  if (!mp && transcurrido > e.segundosDeCobro + gracia) return { estado: "no_pagado", motivo: "No recibimos tu pago a tiempo." };
  return { estado: "esperando", segundosRestantes: Math.max(0, Math.round(e.segundosDeCobro - transcurrido)) };
}
