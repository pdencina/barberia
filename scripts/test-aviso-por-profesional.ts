// Pruebas del filtro "de que profesionales quiero recibir avisos": npx tsx scripts/test-aviso-por-profesional.ts
import assert from "node:assert/strict";
import { wantsProfessional } from "../src/lib/notify";

const me = "u-nico", ana = "u-ana", luis = "u-luis";
// Sin preferencia o "todos": llega todo (como hasta ahora).
assert.equal(wantsProfessional(undefined, me, ana), true);
assert.equal(wantsProfessional({ pro_filter_mode: "all" }, me, ana), true);
// "Solo las mias": solo cuando el profesional soy yo.
assert.equal(wantsProfessional({ pro_filter_mode: "own" }, me, me), true);
assert.equal(wantsProfessional({ pro_filter_mode: "own" }, me, ana), false);
// "Las mias + elegidos".
const sel = { pro_filter_mode: "selected", pro_filter_ids: [ana] };
assert.equal(wantsProfessional(sel, me, me), true);
assert.equal(wantsProfessional(sel, me, ana), true);
assert.equal(wantsProfessional(sel, me, luis), false);
// Elegir a nadie = solo las mias.
assert.equal(wantsProfessional({ pro_filter_mode: "selected", pro_filter_ids: [] }, me, ana), false);
console.log("OK: avisos por profesional");
