// Motivos de rechazo de Mercado Pago en palabras simples. Uso: npx tsx scripts/test-motivo-rechazo.ts
import { motivoRechazo } from "../src/lib/motivo-rechazo";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("OK  ", n); };
ok(/seguridad/i.test(motivoRechazo("cc_rejected_high_risk").cliente) && /no insistas/i.test(motivoRechazo("cc_rejected_high_risk").cliente), "high_risk: avisa que es por seguridad y que no insista con la misma tarjeta");
ok(/saldo|cupo/i.test(motivoRechazo("cc_rejected_insufficient_amount").admin), "saldo insuficiente se explica al administrador");
ok(motivoRechazo("rejected:cc_rejected_high_risk").admin === motivoRechazo("cc_rejected_high_risk").admin, "acepta el estado guardado con el prefijo «rejected:»");
ok(/otra tarjeta/i.test(motivoRechazo("algo_nuevo_de_mp").cliente) && /algo_nuevo_de_mp/.test(motivoRechazo("algo_nuevo_de_mp").admin), "un motivo desconocido no rompe y se muestra tal cual al administrador");
ok(motivoRechazo(null).admin === "Mercado Pago lo rechazó" && motivoRechazo("sin_detalle").admin === "Mercado Pago lo rechazó", "sin detalle: texto genérico");
process.exit(fallos ? 1 : 0);
