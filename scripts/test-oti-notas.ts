// Notas de Oti en el Dashboard. Uso: npx tsx scripts/test-oti-notas.ts
import assert from "node:assert/strict";
import { entenderNota, validarNota, diasHastaDia, estadoVencimiento, ordenarNotas, buscarNotas } from "../src/lib/oti/notas";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };

t("crear: el ejemplo de Nico", () => {
  const r = entenderNota("Oti, tengo que pagar la luz el 5");
  assert.deepEqual(r, { tipo: "crear", texto: "Pagar la luz el 5", dia: 5 });
});
t("crear: otras formas de pedirlo", () => {
  assert.deepEqual(entenderNota("recuérdame pagar el arriendo el 10"), { tipo: "crear", texto: "Pagar el arriendo el 10", dia: 10 });
  assert.deepEqual(entenderNota("Déjame una nota: llamar al contador"), { tipo: "crear", texto: "Llamar al contador", dia: null });
  assert.deepEqual(entenderNota("anótame una nota que hay que renovar la patente el 20"), { tipo: "crear", texto: "Renovar la patente el 20", dia: 20 });
  assert.equal((entenderNota("no se me olvide pagar el IVA el día 12") as any).dia, 12);
});
t("crear: frases comunes o con plata NO son notas", () => {
  assert.equal(entenderNota("tengo que cerrar mi agenda"), null);          // obligación sin día
  assert.equal(entenderNota("cierra mi agenda el viernes"), null);
  assert.equal(entenderNota("pagué la luz $45.000"), null);
  assert.equal(entenderNota("recuérdame pagar $50.000 de luz el 5"), null); // con monto: es un gasto
  assert.equal(entenderNota("cuánto vendió Pablo esta semana"), null);
  assert.equal(entenderNota("el 15 de octubre tengo reunión"), null);
  assert.equal(entenderNota("cómo emito una nota de crédito"), null);       // la palabra «nota» sola no crea nada
  assert.deepEqual(entenderNota("nota: llamar al contador"), { tipo: "crear", texto: "Llamar al contador", dia: null });        // fecha con mes: no es día del mes recurrente
});
t("listar y borrar", () => {
  assert.deepEqual(entenderNota("ver mis notas"), { tipo: "listar" });
  assert.deepEqual(entenderNota("qué notas tengo"), { tipo: "listar" });
  assert.deepEqual(entenderNota("borra la nota de la luz"), { tipo: "borrar", consulta: "luz" });
  assert.deepEqual(entenderNota("Oti, elimina mi nota sobre el arriendo"), { tipo: "borrar", consulta: "arriendo" });
  assert.deepEqual(entenderNota("borra las notas"), { tipo: "borrar", consulta: "" });
});
t("validar nota", () => {
  assert.deepEqual(validarNota({ texto: " Pagar la luz ", dia: 5 }), { ok: true, value: { texto: "Pagar la luz", dia: 5 } });
  assert.deepEqual(validarNota({ texto: "Llamar", dia: null }), { ok: true, value: { texto: "Llamar", dia: null } });
  assert.equal(validarNota({ texto: "", dia: 5 }).ok, false);
  assert.equal(validarNota({ texto: "x".repeat(201) }).ok, false);
  assert.equal(validarNota({ texto: "ok", dia: 32 }).ok, false);
  assert.equal(validarNota({ texto: "ok", dia: 0 }).ok, false);
  assert.equal(validarNota({ texto: "ok", dia: 2.5 }).ok, false);
});
t("días para vencer (incluye mes siguiente y meses cortos)", () => {
  assert.equal(diasHastaDia(5, "2026-11-05"), 0);
  assert.equal(diasHastaDia(5, "2026-11-03"), 2);
  assert.equal(diasHastaDia(5, "2026-11-20"), 15);   // pasa al 5 de diciembre
  assert.equal(diasHastaDia(31, "2026-04-10"), 20);  // abril no tiene 31: vence el 30
  assert.equal(diasHastaDia(5, "2026-12-20"), 16);   // cambio de año
});
t("estado de vencimiento: urgente desde 3 días antes", () => {
  assert.deepEqual(estadoVencimiento(5, "2026-11-05"), { texto: "Es hoy", urgente: true });
  assert.deepEqual(estadoVencimiento(5, "2026-11-04"), { texto: "Mañana", urgente: true });
  assert.deepEqual(estadoVencimiento(5, "2026-11-02"), { texto: "En 3 días", urgente: true });
  assert.equal(estadoVencimiento(5, "2026-11-01")!.urgente, false);
  assert.equal(estadoVencimiento(null, "2026-11-01"), null);
});
t("ordenar y buscar notas", () => {
  const notas = [{ id: "1", texto: "Llamar al contador", dia: null, created_at: "2026-10-01" }, { id: "2", texto: "Pagar la luz el 5", dia: 5, created_at: "2026-10-02" }, { id: "3", texto: "Pagar el arriendo el 10", dia: 10, created_at: "2026-10-03" }];
  assert.deepEqual(ordenarNotas(notas, "2026-11-04").map((n) => n.id), ["2", "3", "1"]);
  assert.deepEqual(buscarNotas(notas, "luz").map((n) => n.id), ["2"]);
  assert.deepEqual(buscarNotas(notas, "arriendo").map((n) => n.id), ["3"]);
  assert.deepEqual(buscarNotas(notas, "").map((n) => n.id), ["1", "2", "3"]);
  assert.deepEqual(buscarNotas(notas, "patente"), []);
});
process.exit(fails ? 1 : 0);
