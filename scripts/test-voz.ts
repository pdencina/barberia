// Atajo de voz: llaves y frases dictadas. Uso: PIN_PEPPER=x npx tsx scripts/test-voz.ts
process.env.PIN_PEPPER = process.env.PIN_PEPPER || "prueba";
import { nuevaLlave, huellaLlave, llaveDeEncabezado, FORMATO_LLAVE } from "../src/lib/voice-key";
import { entenderMovimientoPersonal } from "../src/lib/oti/personal";

let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("ok:", n); };

const k = nuevaLlave();
ok(FORMATO_LLAVE.test(k), "formato de llave");
ok(nuevaLlave() !== k, "llaves distintas");
ok(huellaLlave(k) === huellaLlave(k) && !!huellaLlave(k), "huella estable");
ok(huellaLlave(k) !== k, "la huella no es la llave");
ok(huellaLlave("abc") === null && huellaLlave("") === null, "llave mal formada no tiene huella");
ok(llaveDeEncabezado(`Bearer ${k}`) === k && llaveDeEncabezado(null) === "" && llaveDeEncabezado("Basic x") === "", "encabezado Bearer");

const hoy = "2026-11-03";
const casos: [string, string, number][] = [
  ["Compré el pan para la casa, gasté $1.500", "gasto", 1500],
  ["Compré el pan para la casa, gasté 1500 pesos", "gasto", 1500],
  ["Cargué bencina, me salió $45.000", "gasto", 45000],
  ["Cargué bencina me salió 45000", "gasto", 45000],
  ["Cargué bencina, me salió 45 mil pesos", "gasto", 45000],
  ["Gasté 3 mil en el almuerzo", "gasto", 3000],
  ["Recibí 20 mil por un corte extra", "ingreso", 20000],
];
for (const [t, tipo, monto] of casos) {
  const r = entenderMovimientoPersonal(t, hoy);
  ok(!!r && r.ok && r.movimiento.tipo === tipo && r.movimiento.monto === monto, `«${t}» → ${tipo} ${monto}${r && r.ok ? ` (${r.movimiento.categoria}, «${r.movimiento.descripcion}»)` : ""}`);
}
const sinMonto = entenderMovimientoPersonal("Compré pan para la casa", hoy);
ok(!!sinMonto && !sinMonto.ok, "sin monto pide el monto");
ok(entenderMovimientoPersonal("hola buenas tardes", hoy) === null, "charla no es un gasto");
console.log(fallos ? `\n${fallos} fallas` : "\nTodo bien"); process.exit(fallos ? 1 : 0);
