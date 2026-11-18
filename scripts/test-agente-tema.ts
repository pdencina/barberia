// Memoria de tema de la IA (migración 014): lectura y escritura con una base simulada. Sin red.
// Ejecutar: npx tsx scripts/test-agente-tema.ts
import assert from "node:assert/strict";
import { leerTema, guardarTema, VIGENCIA_TEMA_MIN } from "../src/lib/agente/tema";

const T = "t1", C = "a".repeat(64), AHORA = 1_800_000_000_000;
function bd() {
  const filas = new Map<string, any>();
  const clave = (t: string, c: string) => `${t}|${c}`;
  return { filas, from(tabla: string) {
    assert.equal(tabla, "agent_chat_state");
    let t = "", c = ""; let modo: "select" | "update" | "upsert" = "select"; let valores: any = null;
    const q: any = { select: () => q, eq: (k: string, v: string) => { if (k === "tenant_id") t = v; else c = v; return q; },
      maybeSingle: async () => ({ data: filas.get(clave(t, c)) ?? null, error: null }),
      update: (v: any) => { modo = "update"; valores = v; return q; },
      upsert: async (v: any) => { filas.set(clave(v.tenant_id, v.contact_hash), { ...v }); return { error: null }; },
      then: (res: any) => { if (modo === "update") { const f = filas.get(clave(t, c)); if (f) Object.assign(f, valores); } res({ error: null }); } };
    return q; } };
}
(async () => {
  const db = bd();
  assert.deepEqual(await leerTema(db, T, C, AHORA), [], "sin fila: nada");
  await guardarTema(db, T, C, [3, 7], AHORA);
  const f = db.filas.get(`${T}|${C}`); assert.equal(f.etapa, "tema"); assert.deepEqual(f.datos, { tema: [3, 7] });
  assert.equal(new Date(f.expires_at).getTime(), AHORA + VIGENCIA_TEMA_MIN * 60000);
  assert.deepEqual(await leerTema(db, T, C, AHORA + 60000), [3, 7]);
  assert.deepEqual(await leerTema(db, T, C, AHORA + (VIGENCIA_TEMA_MIN + 1) * 60000), [], "vencido");
  await guardarTema(db, T, C, [9], AHORA + 1000); assert.deepEqual(db.filas.get(`${T}|${C}`).datos, { tema: [9] }, "se reemplaza el tema");
  // Con una reserva en curso: se conserva y solo se agrega el tema
  const oferta = { tenant_id: T, contact_hash: "b".repeat(64), etapa: "oferta", datos: { horaExacta: null, opciones: [{ id: "p" }] }, expires_at: new Date(AHORA + 600000).toISOString() };
  db.filas.set(`${T}|${oferta.contact_hash}`, oferta);
  await guardarTema(db, T, oferta.contact_hash, [4], AHORA);
  const o = db.filas.get(`${T}|${oferta.contact_hash}`); assert.equal(o.etapa, "oferta"); assert.deepEqual(o.datos.tema, [4]); assert.equal(o.datos.opciones.length, 1);
  assert.deepEqual(await leerTema(db, T, oferta.contact_hash, AHORA), [4]);
  // Entradas inválidas y fallos de la base no rompen nada
  await guardarTema(db, T, C, [], AHORA); await guardarTema(db, T, C, [0, -3, 999, 1.5] as any, AHORA);
  assert.deepEqual(db.filas.get(`${T}|${C}`).datos, { tema: [9] }, "ids inválidos no cambian nada");
  const roto: any = { from() { throw new Error("caída"); } };
  assert.deepEqual(await leerTema(roto, T, C, AHORA), []); await guardarTema(roto, T, C, [1], AHORA);
  console.log("OK memoria de tema de la IA (sin red).");
})();
