// Novedades de la semana del Dashboard. Uso: npx tsx scripts/test-novedades.ts
import assert from "node:assert/strict";
import { lunesDe, novedadesProfesionales, novedadesGenerales, novedadesCancelacionesCuenta, novedadCampana, novedadesAlertas, ordenarNovedades, type Totales } from "../src/lib/novedades";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
const base: Totales = { ventas: 1_000_000, ventasPrev: 1_000_000, clientesNuevos: 10, clientesNuevosPrev: 10, cancelaciones: 2, cancelacionesPrev: 2, reservasLink: 20, reservasLinkPrev: 20 };

t("lunes de la semana", () => {
  assert.equal(lunesDe("2026-11-06"), "2026-11-02"); // viernes
  assert.equal(lunesDe("2026-11-02"), "2026-11-02");
  assert.equal(lunesDe("2026-11-08"), "2026-11-02"); // domingo
  assert.equal(lunesDe("2026-11-09"), "2026-11-09");
});
t("profesionales: sube y baja, con umbrales", () => {
  const n = novedadesProfesionales([
    { id: "a", nombre: "Pablo", actual: 400_000, previo: 250_000 },   // +60 %
    { id: "b", nombre: "Javier", actual: 150_000, previo: 320_000 },  // -53 %
    { id: "c", nombre: "Ana", actual: 210_000, previo: 200_000 },     // sin cambio
    { id: "d", nombre: "Chico", actual: 20_000, previo: 10_000 },     // monto muy bajo
  ]);
  assert.deepEqual(n.map((x) => x.id), ["pro-sube:a", "pro-baja:b"]);
  assert.equal(n[0].tipo, "bien"); assert.equal(n[1].tipo, "mal");
  assert.deepEqual(novedadesProfesionales([{ id: "a", nombre: "X", actual: 100, previo: 0 }]), []);
});
t("generales: sin cambios no hay nada", () => { assert.deepEqual(novedadesGenerales(base), []); });
t("generales: ventas, clientes, cancelaciones y link", () => {
  assert.equal(novedadesGenerales({ ...base, ventas: 1_400_000 })[0].id, "ventas-sube");
  assert.equal(novedadesGenerales({ ...base, ventas: 700_000 })[0].id, "ventas-baja");
  assert.equal(novedadesGenerales({ ...base, ventas: 1_100_000 }).length, 0); // cambio chico
  assert.ok(novedadesGenerales({ ...base, clientesNuevos: 18 }).some((x) => x.id === "clientes-suben"));
  assert.ok(novedadesGenerales({ ...base, clientesNuevos: 3 }).some((x) => x.id === "clientes-bajan"));
  assert.ok(novedadesGenerales({ ...base, cancelaciones: 9 }).some((x) => x.id === "cancelaciones-suben"));
  assert.ok(novedadesGenerales({ ...base, cancelaciones: 1, cancelacionesPrev: 8 }).some((x) => x.id === "cancelaciones-bajan"));
  const link = novedadesGenerales({ ...base, reservasLink: 6 }).find((x) => x.id === "link-cae");
  assert.ok(link && link.tipo === "alerta");
});
t("cancelaciones desde una cuenta: el caso de Javier (más de 10)", () => {
  const n = novedadesCancelacionesCuenta([{ id: "j", nombre: "Javier", n: 12 }, { id: "p", nombre: "Pablo", n: 2 }]);
  assert.equal(n.length, 1); assert.equal(n[0].id, "cancela-cuenta:j"); assert.ok(n[0].texto.includes("12"));
  assert.deepEqual(novedadesCancelacionesCuenta([{ id: "p", nombre: "Pablo", n: 4 }]), []);
});
t("campaña: el ejemplo de Nico (8 por el link, 3 por otra vía con cupón)", () => {
  const n = novedadCampana({ nombre: "Campaña 25–45 días", enviadaHace: 12, cupon: "CEJAS GRATIS", destinatarios: 270, volvieron: 11, porLink: 8, usaronCupon: 3, cuponEnOtraVia: 3 });
  assert.equal(n.length, 1); assert.equal(n[0].tipo, "bien");
  assert.ok(n[0].texto.includes("8 agendaron desde el link") && n[0].texto.includes("3 por otra vía") && n[0].texto.includes("3 de ellos mostraron el cupón «CEJAS GRATIS»"));
});
t("campaña: reciente, sin destinatarios o sin retorno", () => {
  assert.deepEqual(novedadCampana(null), []);
  assert.deepEqual(novedadCampana({ nombre: "X", enviadaHace: 1, cupon: null, destinatarios: 50, volvieron: 5, porLink: 5, usaronCupon: 0, cuponEnOtraVia: 0 }), []); // muy reciente
  assert.deepEqual(novedadCampana({ nombre: "X", enviadaHace: 20, cupon: null, destinatarios: 0, volvieron: 0, porLink: 0, usaronCupon: 0, cuponEnOtraVia: 0 }), []);
  assert.deepEqual(novedadCampana({ nombre: "X", enviadaHace: 5, cupon: null, destinatarios: 50, volvieron: 0, porLink: 0, usaronCupon: 0, cuponEnOtraVia: 0 }), []); // aún temprano
  assert.equal(novedadCampana({ nombre: "X", enviadaHace: 10, cupon: null, destinatarios: 50, volvieron: 0, porLink: 0, usaronCupon: 0, cuponEnOtraVia: 0 })[0].tipo, "mal");
});
t("alertas y orden (alertas primero)", () => {
  assert.deepEqual(novedadesAlertas({ abonosPorDevolver: 0 }), []);
  const a = novedadesAlertas({ abonosPorDevolver: 2 });
  assert.equal(a[0].id, "abonos-por-devolver");
  const orden = ordenarNovedades([{ id: "1", tipo: "bien", titulo: "", texto: "" }, a[0], { id: "3", tipo: "mal", titulo: "", texto: "" }]);
  assert.deepEqual(orden.map((x) => x.tipo), ["alerta", "mal", "bien"]);
});
process.exit(fails ? 1 : 0);
