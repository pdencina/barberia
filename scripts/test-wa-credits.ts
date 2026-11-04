// Créditos de WhatsApp: núcleo puro; sin red ni base. Ejecutar: npx tsx scripts/test-wa-credits.ts
import assert from "node:assert/strict";
import { calcularCreditos, decidirGasto, costoEnCreditos } from "../src/lib/wa-credits";
const base = { incluidosMes: 200, usadosMes: 0, packsComprados: 0, packsUsados: 0 };
assert.deepEqual(calcularCreditos(base), { restantesMes: 200, restantesPacks: 0, disponibles: 200 });
assert.deepEqual(calcularCreditos({ ...base, usadosMes: 250 }), { restantesMes: 0, restantesPacks: 0, disponibles: 0 }); // nunca negativo
assert.deepEqual(calcularCreditos({ ...base, packsComprados: 250, packsUsados: 50 }), { restantesMes: 200, restantesPacks: 200, disponibles: 400 });
assert.equal(costoEnCreditos("utility", 4), 1); assert.equal(costoEnCreditos("marketing", 4), 4); assert.equal(costoEnCreditos("marketing", 0), 1);
assert.deepEqual(decidirGasto(base, 1), { ok: true, desdePack: false });
assert.deepEqual(decidirGasto({ ...base, usadosMes: 200, packsComprados: 250 }, 1), { ok: true, desdePack: true }); // se acaba el mes: usa packs
assert.deepEqual(decidirGasto({ ...base, usadosMes: 200 }, 1), { ok: false, desdePack: false }); // sin nada: bloquea
assert.deepEqual(decidirGasto({ ...base, usadosMes: 198, packsComprados: 2 }, 4), { ok: false, desdePack: false }); // marketing no se parte entre mes y pack
assert.deepEqual(decidirGasto({ ...base, usadosMes: 196 }, 4), { ok: true, desdePack: false });
assert.deepEqual(decidirGasto({ incluidosMes: 0, usadosMes: 0, packsComprados: 0, packsUsados: 0 }, 1), { ok: false, desdePack: false }); // Basic/Starter sin packs
console.log("OK 11 comprobaciones de créditos de WhatsApp; sin red ni base.");
