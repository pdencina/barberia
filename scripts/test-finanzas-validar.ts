// Validación de movimientos manuales de Finanzas. Uso: npx tsx scripts/test-finanzas-validar.ts
import { validarMovimientoManual } from "../src/lib/finanzas-validar";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("ok:", n); };
const b = { type: "expense", description: "Luz", amount: 45000, paymentMethod: "transfer", notes: "" };
ok(validarMovimientoManual(b).ok, "movimiento válido");
ok(validarMovimientoManual({ ...b, type: "EXPENSE", paymentMethod: "CASH" }).ok, "acepta mayúsculas (se normaliza)");
ok(!validarMovimientoManual({ ...b, type: "otro" }).ok && !validarMovimientoManual({ ...b, type: undefined }).ok, "tipo obligatorio");
ok(!validarMovimientoManual({ ...b, amount: 0 }).ok && !validarMovimientoManual({ ...b, amount: -5 }).ok && !validarMovimientoManual({ ...b, amount: "abc" }).ok && !validarMovimientoManual({ ...b, amount: 1e12 }).ok, "monto positivo y razonable");
ok(!validarMovimientoManual({ ...b, description: "" }).ok && !validarMovimientoManual({ ...b, description: "x".repeat(201) }).ok, "descripción 1 a 200");
ok(!validarMovimientoManual({ ...b, paymentMethod: "bitcoin" }).ok && !validarMovimientoManual({ ...b, paymentMethod: undefined }).ok, "método de pago conocido");
ok(!validarMovimientoManual({ ...b, notes: "n".repeat(501) }).ok, "notas hasta 500");
const r = validarMovimientoManual({ ...b, type: "INCOME", paymentMethod: "Debit_Card" });
ok(r.ok && r.value.type === "income" && r.value.paymentMethod === "debit_card", "tipo y método en minúscula");
console.log(fallos ? `\n${fallos} fallas` : "\nTodo bien"); process.exit(fallos ? 1 : 0);
