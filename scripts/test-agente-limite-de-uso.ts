// npx tsx scripts/test-agente-limite-de-uso.ts — todos los números son fixtures, no umbrales de producto.
import assert from "node:assert/strict";
import { evaluarLimiteDeUso as evaluar, type EntradaLimiteUso, type EventoUso } from "../src/lib/agente/limite-de-uso";

let casos = 0;
const h = (n: number) => n.toString(16).padStart(64, "0");
const now = 100000;
const base: EntradaLimiteUso = { tenantId: "negocio-a", contactHash: h(1), messageHash: h(2), ahoraMs: now, historial: [], reglas: {
  contacto: { max: 2, ventanaMs: 1000 }, negocio: { max: 3, ventanaMs: 2000 }, bucle: { max: 2, ventanaMs: 500 },
} };
const ev = (overrides: Partial<EventoUso> = {}): EventoUso => ({ tenantId: base.tenantId, contactHash: h(1), messageHash: h(2), atMs: now - 1, ...overrides });
function check(nombre: string, condicion: boolean) { casos++; assert.ok(condicion, nombre); }
check("vacío permite", evaluar(base).permitido);
check("uno permite", evaluar({ ...base, historial: [ev()] }).permitido);
check("contacto al máximo bloquea", evaluar({ ...base, historial: [ev(), ev({ messageHash: h(3) })] }).motivos.includes("limite_contacto"));
check("negocio suma contactos distintos", evaluar({ ...base, historial: [ev({ contactHash: h(3) }), ev({ contactHash: h(4) }), ev({ contactHash: h(5) })] }).motivos.join() === "limite_negocio");
check("otro tenant no cuenta", evaluar({ ...base, historial: [ev({ tenantId: "ajeno" }), ev({ tenantId: "ajeno" }), ev({ tenantId: "ajeno" })] }).conteos.negocio === 0);
check("mismo tenant otro contacto no consume límite individual", evaluar({ ...base, historial: [ev({ contactHash: h(3) })] }).conteos.contacto === 0);
const holgada = { ...base.reglas, contacto: { ...base.reglas.contacto, max: 99 }, negocio: { ...base.reglas.negocio, max: 99 } };
check("bucle bloquea repeticiones del mismo contacto", evaluar({ ...base, reglas: holgada, historial: [ev(), ev()] }).motivos.join() === "bucle");
check("otro mensaje no forma bucle", evaluar({ ...base, reglas: holgada, historial: [ev({ messageHash: h(3) }), ev({ messageHash: h(4) })] }).permitido);
check("mismo texto de otro contacto no forma bucle", evaluar({ ...base, reglas: holgada, historial: [ev({ contactHash: h(3) }), ev({ contactHash: h(3) })] }).permitido);
check("borde izquierdo excluido contacto", evaluar({ ...base, historial: [ev({ atMs: now - 1000 })] }).conteos.contacto === 0);
check("borde dentro contacto", evaluar({ ...base, historial: [ev({ atMs: now - 999 })] }).conteos.contacto === 1);
check("borde izquierdo excluido negocio", evaluar({ ...base, historial: [ev({ atMs: now - 2000 })] }).conteos.negocio === 0);
check("borde dentro negocio", evaluar({ ...base, historial: [ev({ atMs: now - 1999 })] }).conteos.negocio === 1);
check("borde izquierdo excluido bucle", evaluar({ ...base, historial: [ev({ atMs: now - 500 })] }).conteos.repetidos === 0);
check("borde dentro bucle", evaluar({ ...base, historial: [ev({ atMs: now - 499 })] }).conteos.repetidos === 1);
check("ahora incluido", evaluar({ ...base, historial: [ev({ atMs: now })] }).conteos.repetidos === 1);
check("futuro ignorado", evaluar({ ...base, historial: [ev({ atMs: now + 1 })] }).conteos.negocio === 0);
check("pasado vencido ignorado", evaluar({ ...base, historial: [ev({ atMs: 1 })] }).permitido);
check("época cero admitida", evaluar({ ...base, ahoraMs: 0, historial: [ev({ atMs: 0 })] }).conteos.contacto === 1);
const todos = evaluar({ ...base, historial: [ev(), ev(), ev({ contactHash: h(3) })] });
check("motivos simultáneos", todos.motivos.join() === "limite_contacto,limite_negocio,bucle");
check("conteos antes de candidato", todos.conteos.contacto === 2 && todos.conteos.negocio === 3 && todos.conteos.repetidos === 2);
check("salida sin referencias privadas", !JSON.stringify(todos).includes(h(1)) && !JSON.stringify(todos).includes(base.tenantId));
const letras = "abcdef".repeat(10) + "abcd";
check("hash hexadecimal mayúscula normalizado", evaluar({ ...base, contactHash: letras, messageHash: letras, historial: [ev({ contactHash: letras.toUpperCase(), messageHash: letras.toUpperCase() })] }).conteos.repetidos === 1);
for (const nombre of ["contacto", "negocio", "bucle"] as const) {
  const reglas = { ...base.reglas, [nombre]: { ...base.reglas[nombre], max: 0 } };
  check(`máximo cero ${nombre} bloquea sin historial`, !evaluar({ ...base, reglas }).permitido);
  for (const max of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    check(`máximo inválido ${nombre}`, evaluar({ ...base, reglas: { ...base.reglas, [nombre]: { ...base.reglas[nombre], max } } }).motivos.join() === "datos_invalidos");
  }
  for (const ventanaMs of [0, -1, 0.5, Infinity, NaN]) {
    check(`ventana inválida ${nombre}`, evaluar({ ...base, reglas: { ...base.reglas, [nombre]: { ...base.reglas[nombre], ventanaMs } } }).motivos.join() === "datos_invalidos");
  }
}
for (const ahoraMs of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) check("ahora inválido", evaluar({ ...base, ahoraMs }).motivos.join() === "datos_invalidos");
for (const bad of [null, undefined, {}, { ...base, reglas: null }, { ...base, historial: null }, { ...base, contactHash: "teléfono-sintético" }, { ...base, messageHash: "texto crudo" }, { ...base, tenantId: "" }]) {
  check("entrada inválida bloquea", evaluar(bad as EntradaLimiteUso).motivos.join() === "datos_invalidos");
}
for (const bad of [null, {}, ev({ atMs: -1 }), ev({ atMs: NaN }), ev({ contactHash: "mal" }), ev({ messageHash: "mal" }), ev({ tenantId: " " })]) {
  check("historial inválido bloquea", evaluar({ ...base, historial: [bad as EventoUso] }).motivos.join() === "datos_invalidos");
}
const frozenHistory = Object.freeze([Object.freeze(ev()), Object.freeze(ev({ atMs: now - 600 }))]);
const snapshot = JSON.stringify(frozenHistory);
const r1 = evaluar({ ...base, historial: frozenHistory });
const r2 = evaluar({ ...base, historial: [...frozenHistory].reverse() });
check("independiente del orden del historial", JSON.stringify(r1) === JSON.stringify(r2));
check("no muta historial congelado", JSON.stringify(frozenHistory) === snapshot);
check("determinista sin reloj real", JSON.stringify(r1) === JSON.stringify(evaluar({ ...base, historial: frozenHistory })));
const abundante = Array.from({ length: 2000 }, (_, i) => ev({ atMs: now - 1, contactHash: h(i + 10) }));
check("más de mil eventos sin truncar", evaluar({ ...base, historial: abundante }).conteos.negocio === 2000);
console.log(`OK: ${casos} casos de ventana y bucle; sin reloj real, red, base ni umbrales de producto.`);
