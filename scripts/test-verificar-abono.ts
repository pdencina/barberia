// «Abono confirmado» solo si de verdad se pago y se creo la cita. Uso: npx tsx scripts/test-verificar-abono.ts
import { decidirEstadoAbono } from "../src/lib/verificar-abono";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("OK  ", n); };
const REF = "11111111-1111-4111-8111-111111111111";
const ahora = Date.parse("2026-11-16T20:05:00Z");
const joven = { data: { date: "2026-11-24" }, created_at: "2026-11-16T20:02:00Z" };   // creada hace 3 min
const vieja = { data: { date: "2026-11-24" }, created_at: "2026-11-16T19:50:00Z" };   // creada hace 15 min
const base = { ref: REF, ahora, segundosDeCobro: 300, deposito: null, pagoMp: null };
const d = (o: any) => decidirEstadoAbono({ ...base, ...o });

ok(d({ intent: { data: { resultado: "pagado", appointmentId: "cita-1" }, created_at: joven.created_at } }).estado === "pagado", "la reserva que el servidor marcó pagada: confirmada");
ok(d({ intent: { data: { resultado: "conflicto" }, created_at: joven.created_at } }).estado === "conflicto", "pago con horario ocupado: conflicto (se devuelve el abono)");
ok(d({ intent: null }).estado === "desconocido", "sin reserva en espera: no se puede verificar, NUNCA se dice confirmada");
// El caso de Jade: volvió a la pantalla «éxito» pero el pago figuraba cancelado por ella misma.
const jade = d({ intent: joven, deposito: { status: "cancelled:by_payer", appointment_id: null } });
ok(jade.estado === "no_pagado", "pago cancelado por el cliente (volvió a la pantalla de éxito): NO está confirmado");
ok(d({ intent: joven, deposito: { status: "rejected:cc_rejected_high_risk", appointment_id: null } }).estado === "no_pagado" && /seguridad/i.test((d({ intent: joven, deposito: { status: "rejected:cc_rejected_high_risk", appointment_id: null } }) as any).motivo), "pago rechazado: no confirmado y con el motivo en palabras simples");
ok(d({ intent: joven, deposito: { status: "approved", appointment_id: "cita-2" } }).estado === "pagado", "pago aprobado con cita creada: confirmada");
ok(d({ intent: joven, deposito: { status: "approved", appointment_id: null } }).estado === "esperando", "pago aprobado pero la cita aun no existe: no se dice confirmada todavía");
ok(d({ intent: joven, deposito: { status: "needs_refund", appointment_id: null } }).estado === "conflicto", "abono «por devolver»: conflicto");
// Mercado Pago consultado directamente
ok(d({ intent: joven, pagoMp: { status: "approved", external_reference: REF } }).estado === "procesando", "MP dice aprobado y la cita se está creando: procesando (no confirmada aun)");
ok(d({ intent: joven, pagoMp: { status: "rejected", status_detail: "cc_rejected_insufficient_amount", external_reference: REF } }).estado === "no_pagado", "MP dice rechazado: no confirmada");
ok(d({ intent: vieja, pagoMp: { status: "approved", external_reference: "otra-referencia" } }).estado === "no_pagado", "un pago de OTRA reserva no sirve para confirmar esta (y ya venció)");
ok(d({ intent: joven, pagoMp: { status: "approved", external_reference: "otra-referencia" } }).estado === "esperando", "un pago de otra reserva se ignora");
ok(d({ intent: joven, pagoMp: { status: "in_process", external_reference: REF } }).estado === "esperando", "pago en revisión: se sigue esperando");
// Sin ningún pago visible
const e1 = d({ intent: joven });
ok(e1.estado === "esperando" && (e1 as any).segundosRestantes > 0, "dentro del tiempo para pagar y sin pago: esperando");
ok(d({ intent: vieja }).estado === "no_pagado", "pasado el tiempo de pago sin ningún pago: NO confirmada");
ok(d({ intent: vieja, pagoMp: { status: "approved", external_reference: REF } }).estado === "procesando", "pago aprobado que llega tarde: se sigue procesando, no se declara perdido");
process.exit(fallos ? 1 : 0);
