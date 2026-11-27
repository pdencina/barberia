// Abono + cupón: vuelta al link de la promoción y reglas que se guardan al enviar. Sin base de datos.
import { enlaceDeVuelta } from "../src/lib/volver-reserva";
import { reglasDeCampana } from "../src/lib/reglas-campana";
import { resumenAbono } from "../src/lib/resumen-abono";
import { SIN_CONDICIONES } from "../src/lib/promo-condiciones";
let f = 0;
const ok = (c: boolean, t: string) => { if (!c) { f++; console.log("FALLA", t); } };
ok(enlaceDeVuelta("?n=looky-estudio&c=PRIMERPASO").href === "/looky-estudio/promocion?cupon=PRIMERPASO", "vuelve a la promoción");
ok(enlaceDeVuelta("?n=looky-estudio&c=a%20b/..").href === "/looky-estudio", "código raro se ignora");
ok(reglasDeCampana({ servicioIds: ["x"] }, SIN_CONDICIONES, "", "") === null, "sin nada puesto no se toca");
const r = reglasDeCampana({ servicioIds: ["x"], titulo: "Antes" }, { ...SIN_CONDICIONES, hasta: "2026-12-31", pagos: ["Efectivo"] }, "https://x.cl/i.png", "")!;
ok(r.titulo === "Antes" && r.servicioIds[0] === "x" && r.hasta === "2026-12-31" && r.pagos[0] === "cash" && r.imagen === "https://x.cl/i.png", "suma sin borrar");
const c = resumenAbono(30000, 5000, 10000);
ok(c.abono === 10000 && c.saldo === 15000, "abona lo de siempre y el descuento baja lo del local");
ok(resumenAbono(12000, 5000, 10000).abono === 7000 && resumenAbono(12000, 5000, 10000).saldo === 0, "nunca se abona más de lo que cuesta");
console.log(f ? `${f} FALLAS` : "OK promoción con abono");
process.exit(f ? 1 : 0);
