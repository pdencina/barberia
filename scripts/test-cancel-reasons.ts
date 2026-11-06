// Motivos de cancelación y recomendaciones. Uso: npx tsx scripts/test-cancel-reasons.ts
import assert from "node:assert/strict";
import { resumirCancelaciones, consejosCancelaciones, consejosConfirmadas, motivoValido, etiquetaMotivo, etiquetaQuien, textoQuienCancelo, errorMotivoEquipo, afectaAsistencia, puedeMarcarNoLlego, aHoraPared, textoMomento } from "../src/lib/cancel-reasons";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
const base = { reservas: 20, confirmadas: 5, clientesNuevos: 0, reservasCambio: 0, clientesCambio: 0, cancelacionesCambio: 0 };

t("resumen: cuenta canceladas, no llegaron, quién y motivos", () => {
  const r = resumirCancelaciones([
    { status: "cancelled", cancelled_by: "client", cancel_reason: "imprevisto" },
    { status: "cancelled", cancelled_by: "client", cancel_reason: "imprevisto" },
    { status: "cancelled", cancelled_by: "receptionist", cancel_reason: "error" },
    { status: "cancelled" },
    { status: "no_show" },
  ]);
  assert.equal(r.total, 5); assert.equal(r.canceladas, 4); assert.equal(r.noLlegaron, 1); assert.equal(r.sinRegistro, 1);
  assert.equal(r.porQuien[0].quien, "client"); assert.equal(r.porQuien[0].n, 2);
  assert.equal(r.motivos[0].nombre, "Tuve un imprevisto");
});
t("solo se aceptan motivos conocidos", () => {
  assert.equal(motivoValido("imprevisto"), "imprevisto"); assert.equal(motivoValido("<script>"), null); assert.equal(motivoValido(5), null);
  assert.equal(etiquetaMotivo(null), "Sin motivo registrado"); assert.equal(etiquetaQuien("receptionist"), "Recepción");
});
t("consejos: sin cancelaciones, no llegaron, mayoría cliente, equipo y sin motivo", () => {
  assert.equal(consejosCancelaciones({ ...base, cancel: resumirCancelaciones([]) })[0].titulo, "Sin cancelaciones");
  const nl = consejosCancelaciones({ ...base, cancel: resumirCancelaciones([{ status: "no_show" }]) });
  assert.ok(nl.some((c) => c.titulo === "Clientes que no llegaron"));
  const cli = consejosCancelaciones({ ...base, cancel: resumirCancelaciones([1, 2, 3].map(() => ({ status: "cancelled", cancelled_by: "client", cancel_reason: "imprevisto" }))) });
  assert.ok(cli.some((c) => c.titulo.includes("clientes")));
  const eq = consejosCancelaciones({ ...base, cancel: resumirCancelaciones([{ status: "cancelled", cancelled_by: "barber", cancel_reason: "profesional" }, { status: "cancelled", cancelled_by: "client", cancel_reason: "otro" }]) });
  assert.ok(eq.some((c) => c.titulo.includes("equipo")));
  const sm = consejosCancelaciones({ ...base, cancel: resumirCancelaciones([{ status: "cancelled" }, { status: "cancelled" }]) });
  assert.ok(sm.some((c) => c.titulo === "Falta el motivo"));
});
t("consejos confirmadas según la proporción", () => {
  assert.ok(consejosConfirmadas({ ...base, cancel: resumirCancelaciones([]) })[0].titulo === "Pocas citas confirmadas");
  assert.ok(consejosConfirmadas({ ...base, confirmadas: 18, cancel: resumirCancelaciones([]) })[0].titulo === "Buena confirmación");
});
t("quién canceló, lo más exacto posible", () => {
  assert.equal(textoQuienCancelo({ cancelled_by: "client", cancel_channel: "link" }), "El cliente desde el link de su cita");
  assert.equal(textoQuienCancelo({ cancelled_by: "client", cancel_channel: "portal" }), "El cliente desde su portal de cliente");
  assert.equal(textoQuienCancelo({ cancelled_by: "receptionist", userName: "Ana Pérez", cancel_channel: "panel" }), "Ana Pérez (recepción)");
  assert.ok(textoQuienCancelo({ cancelled_by: "admin" }).includes("cuenta no identificada"));
  assert.ok(textoQuienCancelo({}).startsWith("Sin registrar"));
});
t("cancelar exige motivo y «Otro motivo» exige escribir cuál", () => {
  assert.ok(errorMotivoEquipo(undefined, "")?.includes("Elige"));
  assert.ok(errorMotivoEquipo("basura", "")?.includes("Elige"));
  assert.equal(errorMotivoEquipo("cliente_aviso", ""), null);
  assert.ok(errorMotivoEquipo("otro", "")?.includes("Escribe"));
  assert.ok(errorMotivoEquipo("otro", "no")?.includes("Escribe"));
  assert.ok(errorMotivoEquipo("otro", "     ")?.includes("Escribe"));
  assert.equal(errorMotivoEquipo("otro", "El cliente tuvo un accidente"), null);
});
t("la asistencia del cliente baja con 'no llegó' y con sus cancelaciones, no con las del equipo", () => {
  assert.equal(afectaAsistencia({ status: "no_show" }), true);
  assert.equal(afectaAsistencia({ status: "cancelled", cancel_reason: "cliente_aviso" }), true);
  assert.equal(afectaAsistencia({ status: "cancelled", cancel_reason: "imprevisto" }), true);
  assert.equal(afectaAsistencia({ status: "cancelled" }), true); // sin motivo registrado: como antes
  assert.equal(afectaAsistencia({ status: "cancelled", cancel_reason: "profesional" }), false);
  assert.equal(afectaAsistencia({ status: "cancelled", cancel_reason: "error" }), false);
  assert.equal(afectaAsistencia({ status: "cancelled", cancel_reason: "cambio_hora" }), false);
  assert.equal(afectaAsistencia({ status: "completed" }), false);
});
t("«No llegó» solo cuando la cita ya empezó", () => {
  const inicio = new Date(Date.UTC(2026, 10, 6, 16, 30)); // 16:30 hora de pared
  assert.equal(puedeMarcarNoLlego(inicio, new Date(Date.UTC(2026, 10, 6, 14, 5))), false);
  assert.equal(puedeMarcarNoLlego(inicio, new Date(Date.UTC(2026, 10, 6, 16, 30))), true);
  assert.equal(puedeMarcarNoLlego(inicio, new Date(Date.UTC(2026, 10, 6, 17, 10))), true);
});
t("hora de pared de Chile y texto del momento del registro", () => {
  assert.equal(aHoraPared(new Date("2026-11-06T22:00:00Z")).getUTCHours(), 19);   // verano: UTC-3
  assert.equal(aHoraPared(new Date("2026-07-06T22:00:00Z")).getUTCHours(), 18);   // invierno: UTC-4
  const inicio = new Date(Date.UTC(2026, 10, 6, 16, 30));
  const m = textoMomento(new Date("2026-11-06T17:05:00Z"), inicio);              // 14:05 en Chile
  assert.equal(m.cuando, "14:05"); assert.equal(m.aviso, "2 h 25 min antes de la hora de la cita");
  const despues = textoMomento(new Date("2026-11-06T19:40:00Z"), inicio);        // 16:40
  assert.equal(despues.aviso, "10 min después de la hora de la cita");
  assert.deepEqual(textoMomento(null, inicio), { cuando: "", aviso: null });
});
process.exit(fails ? 1 : 0);
