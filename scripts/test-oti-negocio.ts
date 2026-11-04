// Oti: movimientos del negocio (solo administrador). Uso: npx tsx scripts/test-oti-negocio.ts
import { validarMovimientoNegocio, pareceDelNegocio } from "../src/lib/oti/negocio";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("ok:", n); };
const HOY = "2026-11-03";
const base = { tipo: "gasto", monto: 50000, descripcion: "Insumos", fecha: "2026-11-02", medio: "transfer" };
ok(validarMovimientoNegocio(base, HOY).ok, "movimiento válido");
ok(!validarMovimientoNegocio({ ...base, medio: "" }, HOY).ok, "sin método de pago no pasa (no hay valor por defecto)");
ok(!validarMovimientoNegocio({ ...base, medio: "bitcoin" }, HOY).ok, "método desconocido no pasa");
ok(!validarMovimientoNegocio({ ...base, monto: 0 }, HOY).ok && !validarMovimientoNegocio({ ...base, monto: 1.5 }, HOY).ok && validarMovimientoNegocio({ ...base, monto: "5" }, HOY).ok, "monto entero positivo (un texto numérico se acepta)");
ok(!validarMovimientoNegocio({ ...base, fecha: "2026-12-30" }, HOY).ok, "no acepta fechas futuras");
ok(!validarMovimientoNegocio({ ...base, fecha: "2024-01-01" }, HOY).ok, "no acepta fechas muy antiguas");
ok(!validarMovimientoNegocio({ ...base, tipo: "otro" }, HOY).ok && !validarMovimientoNegocio({ ...base, descripcion: "  " }, HOY).ok, "tipo y descripción obligatorios");
ok(pareceDelNegocio("Compré insumos para la barbería $50.000") && pareceDelNegocio("Pagué la luz del local") && !pareceDelNegocio("Compré pan, me salió $1.200"), "detecta frases del negocio");
console.log(fallos ? `\n${fallos} fallas` : "\nTodo bien"); process.exit(fallos ? 1 : 0);
