// Asientos del plan. Uso: npx tsx scripts/test-seats.ts
import assert from "node:assert/strict";
import { cambioUsaAsiento } from "../src/lib/seats";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
t("reactivar a un profesional usa un asiento", () => assert.equal(cambioUsaAsiento({ role: "barber", active: false }, { active: true }), true));
t("desactivar o editar el nombre no usa asiento", () => { assert.equal(cambioUsaAsiento({ role: "barber", active: true }, { active: false }), false); assert.equal(cambioUsaAsiento({ role: "barber", active: true }, {}), false); });
t("un administrador que pasa a atender clientes usa un asiento; uno que ya atiende, no", () => {
  assert.equal(cambioUsaAsiento({ role: "admin", active: true, also_attends_clients: false }, { also_attends_clients: true }), true);
  assert.equal(cambioUsaAsiento({ role: "admin", active: true, also_attends_clients: true }, { also_attends_clients: true }), false);
  assert.equal(cambioUsaAsiento({ role: "admin", active: true, also_attends_clients: false }, { also_attends_clients: false }), false);
});
t("recepción nunca usa asiento", () => assert.equal(cambioUsaAsiento({ role: "receptionist", active: false }, { active: true, also_attends_clients: true }), false));
t("reactivar a un administrador que atiende usa un asiento", () => assert.equal(cambioUsaAsiento({ role: "admin", active: false, also_attends_clients: true }, { active: true }), true));
process.exit(fails ? 1 : 0);
