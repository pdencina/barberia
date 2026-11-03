// Resumen de reseñas del negocio. Uso: npx tsx scripts/test-resenas.ts
import assert from "node:assert/strict";
import { resumirResenas } from "../src/lib/resenas";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
const barbers = [{ id: "a", name: "Ana" }, { id: "b", name: "Beto" }];
const r = (id: string, rating: number, fecha: string, barber_id = "a", comment: string | null = null, client_name: string | null = null) => ({ id, rating, comment, created_at: `${fecha}T15:00:00Z`, barber_id, client_name });
const rows = [r("1", 5, "2026-11-02", "a", "Excelente", "Pablo"), r("2", 4, "2026-10-15", "b"), r("3", 5, "2026-10-01", "a"), r("4", 3, "2026-09-10", "b", "Regular"), r("5", 9, "2026-11-01"), r("6", 0, "2026-11-01")];
const x = resumirResenas(rows, barbers, "2026-11-03", 6);

t("ignora notas fuera de 1 a 5", () => { assert.equal(x.total, 4); });
t("promedio", () => { assert.equal(x.promedio, 4.25); });
t("este mes y mes anterior", () => { assert.equal(x.esteMes, 1); assert.equal(x.mesAnterior, 2); });
t("serie por mes: 6 meses, de más antiguo a más nuevo, con ceros", () => { assert.equal(x.porMes.length, 6); assert.equal(x.porMes[0].mes, "2026-06"); assert.equal(x.porMes[5].mes, "2026-11"); assert.equal(x.porMes[3].cantidad, 1); assert.equal(x.porMes[4].cantidad, 2); assert.equal(x.porMes[0].cantidad, 0); });
t("distribución de estrellas", () => { assert.deepEqual(x.distribucion.map((d) => d.cantidad), [2, 1, 1, 0, 0]); });
t("por profesional, con nombre", () => { assert.equal(x.porProfesional.length, 2); const ana = x.porProfesional.find((p) => p.id === "a")!; assert.equal(ana.nombre, "Ana"); assert.equal(ana.cantidad, 2); assert.equal(ana.promedio, 5); });
t("recientes: más nueva primero, con cliente y comentario", () => { assert.equal(x.recientes[0].id, "1"); assert.equal(x.recientes[0].cliente, "Pablo"); assert.equal(x.recientes[0].comment, "Excelente"); assert.equal(x.recientes[1].cliente, "Cliente"); });
t("sin reseñas no falla", () => { const v = resumirResenas([], barbers, "2026-11-03", 3); assert.equal(v.total, 0); assert.equal(v.promedio, 0); assert.equal(v.porMes.length, 3); });
process.exit(fails ? 1 : 0);
