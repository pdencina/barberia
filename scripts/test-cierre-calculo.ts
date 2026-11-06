// Cierre mensual que cuadra (caso LOOKY Estudio, octubre 2026). Uso: npx tsx scripts/test-cierre-calculo.ts
import assert from "node:assert/strict";
import { repartirVentas, cuadra, profesionalUnico, atiendeClientes, type VentaCierre } from "../src/lib/cierre-calculo";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
const S = (description: string, total: number, quantity = 1) => ({ description, total, quantity, tipo: "servicio" as const });
const P = (description: string, total: number, quantity = 1) => ({ description, total, quantity, tipo: "producto" as const });

t("un descuento se resta del servicio cobrado (correctivo de $31.000 cobrado en $20.000)", () => {
  const r = repartirVentas([{ id: "1", total: 20000, lineas: [S("Correctivo", 31000)] }]);
  assert.equal(r.servicios[0].lista, 31000); assert.equal(r.servicios[0].cobrado, 20000); assert.equal(r.servicios[0].descuentos, 11000);
  assert.equal(r.descuentos, 11000); assert.equal(cuadra(r).ok, true);
});
t("la cantidad no cambia y el total por servicio suma lo cobrado", () => {
  const ventas: VentaCierre[] = [
    { id: "a", total: 31000, lineas: [S("Correctivo", 31000)] },
    { id: "b", total: 28000, lineas: [S("Correctivo", 31000)] },   // descuento 3.000
    { id: "c", total: 36000, lineas: [S("Correctivo", 31000), P("Diseño uña", 5000, 10)] },
  ];
  const r = repartirVentas(ventas);
  assert.equal(r.servicios[0].cantidad, 3); assert.equal(r.productos[0].cantidad, 10);
  assert.equal(r.serviciosCobrado + r.productosCobrado, 95000); assert.equal(r.totalVentas, 95000); assert.equal(cuadra(r).ok, true);
});
t("venta anotada a mano donde el servicio ya incluye el diseño: no se cuenta dos veces", () => {
  // servicio $36.000 + producto $5.000 pero se cobró $36.000
  const r = repartirVentas([{ id: "x", total: 36000, lineas: [P("Diseño uña", 5000, 10), S("Correctivo", 36000)] }]);
  assert.equal(r.serviciosCobrado + r.productosCobrado, 36000);
  assert.equal(r.ventasAjustadas.length, 1); assert.equal(r.ventasAjustadas[0].diferencia, 5000);
  assert.equal(cuadra(r).ok, true);
});
t("venta sin líneas o con líneas que no explican todo: la diferencia queda 'sin detalle' y cuadra", () => {
  const r = repartirVentas([{ id: "m", total: 12000, lineas: [] }, { id: "n", total: 30000, lineas: [S("Corte", 25000)] }]);
  assert.equal(r.sinDetalle, 17000); assert.equal(r.serviciosCobrado, 25000); assert.equal(r.totalVentas, 42000); assert.equal(cuadra(r).ok, true);
  assert.equal(r.servicios[0].cobrado, 25000); // no se infla
});
t("ordena por lo cobrado y resume el caso de Saray (suma lista − descuentos + productos = total)", () => {
  const r = repartirVentas([
    { id: "1", total: 20000, lineas: [S("Correctivo", 31000)] },
    { id: "2", total: 35000, lineas: [S("Extensión", 35000)] },
    { id: "3", total: 12000, lineas: [P("Puluk", 12000)] },
  ]);
  assert.equal(r.servicios[0].nombre, "Extensión");
  assert.equal(r.serviciosLista - r.descuentos + r.productosLista, r.totalVentas + 0); // 66.000 - 11.000 + 12.000 = 67.000
  assert.equal(r.totalVentas, 67000);
});
t("profesional único: una sola persona atiende (también una administradora que atiende)", () => {
  assert.equal(profesionalUnico([{ id: "s", role: "admin", active: true, also_attends_clients: true }]), "s");
  assert.equal(profesionalUnico([{ id: "s", role: "admin", active: true, also_attends_clients: true }, { id: "r", role: "receptionist", active: true }]), "s");
  assert.equal(profesionalUnico([{ id: "a", role: "barber", active: true }, { id: "b", role: "barber", active: true }]), null);
  assert.equal(profesionalUnico([{ id: "a", role: "admin", active: true, also_attends_clients: false }]), null);
  assert.equal(profesionalUnico([{ id: "a", role: "barber", active: true }, { id: "b", role: "barber", active: false }]), "a");
  assert.equal(atiendeClientes({ id: "x", role: "receptionist", active: true }), false);
});
process.exit(fails ? 1 : 0);
