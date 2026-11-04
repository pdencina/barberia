// Máquina Mercado Pago Point lista: solo el número de serie. Uso: npx tsx scripts/test-mp-terminal.ts
import assert from "node:assert/strict";
import { deviceIdDesdeSerie, serieDesdeDeviceId, MP_DEVICE_PREFIX } from "../src/lib/mp-terminal";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
const dev = (s: string) => deviceIdDesdeSerie(s) as any;

t("serie simple arma el Device ID", () => { assert.deepEqual(dev("NCD300018012"), { ok: true, serie: "NCD300018012", deviceId: "NEWLAND_N950__NCD300018012" }); });
t("acepta minúsculas, espacios y «S/N:»", () => { for (const x of ["ncd300018012", " NCD 300018012 ", "S/N: NCD300018012", "sn NCD-300018012"]) assert.equal(dev(x).deviceId, "NEWLAND_N950__NCD300018012", x); });
t("series que ya traen N950 (como las de Estudio Levels)", () => { assert.equal(dev("N950NCC804366876").deviceId, `${MP_DEVICE_PREFIX}N950NCC804366876`); });
t("acepta el Device ID completo y no lo duplica", () => { assert.equal(dev("NEWLAND_N950__NCD300018012").deviceId, "NEWLAND_N950__NCD300018012"); assert.equal(dev("newland_n950__ncd300018012").serie, "NCD300018012"); });
t("rechaza vacío, cortos, largos y símbolos", () => { for (const x of ["", "   ", "ABC", "x".repeat(40), "NCD3000$8012", "NEWLAND_N950__"]) assert.equal(dev(x).ok, false, x); });
t("muestra solo la serie de un Device ID guardado", () => { assert.equal(serieDesdeDeviceId("NEWLAND_N950__NCD300018012"), "NCD300018012"); assert.equal(serieDesdeDeviceId(null), ""); assert.equal(serieDesdeDeviceId("SIN_GUION"), "SIN_GUION"); });
process.exit(fails ? 1 : 0);
