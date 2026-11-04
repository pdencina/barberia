// Bloqueo del horario mientras se paga el abono. Uso: npx tsx scripts/test-deposit-hold.ts
import assert from "node:assert/strict";
import { crearHold, liberarHold, limpiarHoldsVencidos, HOLD_SEGUNDOS } from "../src/lib/deposit-hold";
import { estadoReservaEnPago } from "../src/lib/booking-intent";
import { resolverServicios } from "../src/lib/booking-services";
let fails = 0;
const t = (n: string, f: () => void | Promise<void>) => Promise.resolve().then(f).then(() => console.log("OK  " + n), (e: any) => { fails++; console.log("MAL " + n + ": " + e.message); });

// Un «supabase» falso: cada tabla responde con lo configurado y anota lo que se le pide.
function fake(respuestas: Record<string, any>) {
  const llamadas: any[] = [];
  const cadena = (tabla: string, op: string, datos?: any): any => new Proxy({}, {
    get: (_o, prop: string) => {
      if (prop === "then") { const r = respuestas[`${tabla}.${op}`] ?? { data: null, error: null }; return (res: any) => res(r); }
      return (...args: any[]) => { llamadas.push({ tabla, op, prop, args, datos }); return cadena(tabla, op, datos); };
    },
  });
  const cliente = { from: (tabla: string) => ({ insert: (d: any) => { llamadas.push({ tabla, op: "insert", datos: d }); return cadena(tabla, "insert", d); }, delete: () => cadena(tabla, "delete"), select: () => cadena(tabla, "select") }) };
  return { cliente, llamadas };
}

(async () => {
  await t("el bloqueo dura 3 minutos (no más)", () => { assert.equal(HOLD_SEGUNDOS, 180); });
  await t("crea el bloqueo con la hora del servicio y vence a los 3 minutos", async () => {
    const { cliente, llamadas } = fake({});
    const h = await crearHold(cliente, { barberId: "b1", date: "2026-11-05", start: new Date("2026-11-05T15:00:00Z"), end: new Date("2026-11-05T15:45:00Z") });
    assert.ok(h && /^[0-9a-f-]{36}$/.test(h.ref));
    const ins = llamadas.find((l) => l.op === "insert").datos;
    assert.equal(ins.barber_id, "b1"); assert.equal(ins.all_day, false); assert.equal(ins.start_time, "15:00"); assert.equal(ins.end_time, "15:45"); assert.equal(ins.hold_ref, h!.ref);
    const seg = (Date.parse(ins.hold_expires_at) - Date.now()) / 1000;
    assert.ok(seg > HOLD_SEGUNDOS - 5 && seg <= HOLD_SEGUNDOS, String(seg));
    assert.ok(Math.abs(h!.expira.getTime() - Date.parse(ins.hold_expires_at)) < 5);
  });
  await t("estado del pago: esperando con tiempo restante, pagado, conflicto y vencido (con 45 s de gracia)", () => {
    const creado = new Date("2026-11-05T12:00:00Z"), t0 = creado.getTime();
    assert.deepEqual(estadoReservaEnPago({}, creado, t0 + 60_000, 210), { estado: "esperando", segundosRestantes: 150 });
    assert.deepEqual(estadoReservaEnPago({ resultado: "pagado", appointmentId: "a1" }, creado, t0 + 400_000, 210), { estado: "pagado", appointmentId: "a1" });
    assert.deepEqual(estadoReservaEnPago({ resultado: "conflicto" }, creado, t0 + 100_000, 210), { estado: "conflicto" });
    assert.deepEqual(estadoReservaEnPago({}, creado, t0 + 230_000, 210), { estado: "esperando", segundosRestantes: 0 }); // en la gracia: aún puede llegar el aviso
    assert.deepEqual(estadoReservaEnPago({}, creado, t0 + 300_000, 210), { estado: "vencido" });
    assert.deepEqual(estadoReservaEnPago(null, creado, t0 + 10_000, 210), { estado: "esperando", segundosRestantes: 200 });
  });
  await t("sin la migración (la columna no existe) no bloquea pero tampoco falla", async () => {
    const { cliente } = fake({ "barber_blocks.insert": { data: null, error: { message: 'column "hold_ref" does not exist' } } });
    assert.equal(await crearHold(cliente, { barberId: "b1", date: "2026-11-05", start: new Date("2026-11-05T15:00:00Z"), end: new Date("2026-11-05T15:30:00Z") }), null);
  });
  await t("liberar sin referencia no hace nada; con referencia borra por esa referencia", async () => {
    const a = fake({}); await liberarHold(a.cliente, null); assert.equal(a.llamadas.length, 0);
    const b = fake({}); await liberarHold(b.cliente, "abc"); assert.ok(b.llamadas.some((l) => l.prop === "eq" && l.args[0] === "hold_ref" && l.args[1] === "abc"));
  });
  await t("limpiar vencidos borra solo los vencidos del profesional y día pedidos", async () => {
    const a = fake({}); await limpiarHoldsVencidos(a.cliente, { barberId: "b1", date: "2026-11-05" });
    assert.ok(a.llamadas.some((l) => l.prop === "lt" && l.args[0] === "hold_expires_at"));
    assert.ok(a.llamadas.some((l) => l.prop === "eq" && l.args[0] === "barber_id" && l.args[1] === "b1"));
    assert.ok(a.llamadas.some((l) => l.prop === "eq" && l.args[0] === "date" && l.args[1] === "2026-11-05"));
  });
  await t("el total sale de los precios del profesional (precio propio) y la duración suma", async () => {
    const { cliente } = fake({
      "services.select": { data: [{ id: "s1", name: "Corte", price: 20000, duration: 30 }, { id: "s2", name: "Barba", price: 8000, duration: 20 }], error: null },
      "barber_services.select": { data: [{ service_id: "s1", custom_price: 25000, custom_duration: 45 }], error: null },
    });
    const r = await resolverServicios(cliente, "b1", "t1", ["s1", "s2"]);
    assert.ok(r); assert.equal(r!.total, 33000); assert.equal(r!.duracion, 65);
  });
  await t("un servicio que no es del negocio invalida la reserva", async () => {
    const { cliente } = fake({ "services.select": { data: [{ id: "s1", name: "Corte", price: 20000, duration: 30 }], error: null } });
    assert.equal(await resolverServicios(cliente, "b1", "t1", ["s1", "s-ajeno"]), null);
  });
  process.exit(fails ? 1 : 0);
})();
