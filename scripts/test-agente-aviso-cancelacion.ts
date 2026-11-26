// Horarios de confirmación, aviso y cancelación automática. Sin red, base ni llaves.
// Ejecutar: npx tsx scripts/test-agente-aviso-cancelacion.ts
import assert from "node:assert/strict";
import { tocaConfirmar, tocaAvisar, tocaCancelar } from "../src/lib/agente/horario-confirmacion";
import { procesarAvisos, type DepsAviso, type Pendiente } from "../src/lib/agente/aviso-cancelacion";

let casos = 0;
const caso = async (n: string, f: () => Promise<void> | void) => { casos++; try { await f(); } catch (e) { throw new Error(`${n}: ${e instanceof Error ? e.message : "fallo"}`); } };
// Hora de pared: día de noviembre y "HH:MM".
const p = (d: number, h: string) => Date.parse(`2026-11-${d}T${h}:00.000Z`);

(async () => {
  await caso("Cita de mañana a las 10: confirmación 21:00, aviso 22:00, cancelación 23:00", () => {
    const inicio = p(27, "10:00"), creada = p(24, "12:00");
    assert.equal(tocaConfirmar(inicio, creada, p(26, "20:55")), false);
    assert.equal(tocaConfirmar(inicio, creada, p(26, "21:00")), true);
    const c = { inicio, creada, enviada: p(26, "21:00") };
    assert.equal(tocaAvisar(c, p(26, "21:55")), false);
    assert.equal(tocaAvisar(c, p(26, "22:00")), true);
    assert.equal(tocaCancelar({ inicio, avisada: p(26, "22:00") }, p(26, "22:55")), false);
    assert.equal(tocaCancelar({ inicio, avisada: p(26, "22:00") }, p(26, "23:00")), true);
  });
  await caso("Cita de la tarde: 8 horas antes, aviso 1 hora después", () => {
    const inicio = p(27, "15:00"), creada = p(24, "12:00");
    assert.equal(tocaConfirmar(inicio, creada, p(27, "06:55")), false);
    assert.equal(tocaConfirmar(inicio, creada, p(27, "07:00")), true);
    assert.equal(tocaAvisar({ inicio, creada, enviada: p(27, "07:00") }, p(27, "08:00")), true);
    assert.equal(tocaConfirmar(p(27, "14:00"), creada, p(26, "21:00")), false, "las 14:00 en adelante usan las 8 horas");
    assert.equal(tocaConfirmar(p(27, "13:45"), creada, p(26, "21:00")), true);
  });
  await caso("Reservada a las 21:30 para las 10: solo la confirmación, sin aviso ni cancelación", () => {
    const inicio = p(27, "10:00"), creada = p(26, "21:30");
    assert.equal(tocaConfirmar(inicio, creada, p(26, "21:30")), true);
    for (const h of ["06:00", "08:00", "08:05", "09:00"]) assert.equal(tocaAvisar({ inicio, creada, enviada: p(26, "21:30") }, p(27, h)), false, h);
  });
  await caso("Reservada de noche para más tarde: aviso a las 08:00, cancelación a las 09:00", () => {
    const inicio = p(27, "16:00"), creada = p(26, "22:15");
    assert.equal(tocaConfirmar(inicio, creada, p(26, "22:15")), true, "al momento");
    const c = { inicio, creada, enviada: p(26, "22:15") };
    assert.equal(tocaAvisar(c, p(26, "23:20")), false);
    assert.equal(tocaAvisar(c, p(27, "07:55")), false);
    assert.equal(tocaAvisar(c, p(27, "08:00")), true);
    assert.equal(tocaCancelar({ inicio, avisada: p(27, "08:00") }, p(27, "09:00")), true);
  });
  await caso("Reservada de madrugada: aviso a las 08:00, no antes", () => {
    const inicio = p(27, "16:00"), creada = p(27, "02:00"), c = { inicio, creada, enviada: p(27, "06:00") };
    assert.equal(tocaConfirmar(inicio, creada, p(27, "06:00")), true);
    assert.equal(tocaAvisar(c, p(27, "07:05")), false);
    assert.equal(tocaAvisar(c, p(27, "08:00")), true);
  });
  await caso("Reserva de última hora, o aviso muy tarde: nunca se cancela", () => {
    assert.equal(tocaAvisar({ inicio: p(27, "17:00"), creada: p(27, "14:30"), enviada: p(27, "14:30") }, p(27, "15:30")), false);
    assert.equal(tocaAvisar({ inicio: p(28, "10:00"), creada: p(24, "12:00"), enviada: p(27, "21:00") }, p(27, "23:05")), false);
    assert.equal(tocaCancelar({ inicio: p(27, "12:00"), avisada: p(27, "09:00") }, p(27, "11:30")), false, "ya está por llegar");
  });

  const fila = (extra: Partial<Pendiente["cita"]> = {}, aviso: Pendiente["aviso"] = null): Pendiente => ({
    cita: { id: "a", tenant_id: "T", status: "scheduled", start_time: "2026-11-27T15:00:00+00:00", date: "2026-11-27", reminder_sent: false, created_at: "2026-11-24T15:00:00Z", updated_at: "2026-11-24T15:00:00Z",
      client: { id: "c", tenant_id: "T", name: "Amaro", phone: "+56911112222", email: null }, barber: { name: "N" }, services: [], ...extra },
    confirmacion: { estado: "aceptado_proveedor", aceptado: "2026-11-27T10:00:00Z" }, aviso, // 07:00 en Santiago
  });
  const armar = (f: Pendiente, ahoraUtc: string, o: { respondio?: boolean; envio?: "aceptado" | "fallido"; activo?: boolean } = {}) => {
    const e = { enviados: [] as string[], canceladas: 0, notificado: 0, finales: [] as string[] };
    const deps: DepsAviso = {
      sal: "sal", ahora: () => Date.parse(ahoraUtc), consumirCuota: async () => true, notificar: async () => { e.notificado++; },
      enviar: async (_n, _c, _p, limite) => { e.enviados.push(limite); return o.envio === "fallido" ? { estado: "fallido" } : { estado: "aceptado", id: "w" }; },
      repo: { negocios: async () => o.activo === false ? [] : [{ tenantId: "T", phoneNumberId: "1", enabled: true }], pendientes: async () => [f],
        respondio: async () => !!o.respondio, baja: async () => false, reclamarAviso: async () => "r", finalizarAviso: async (_c, _i, s) => { e.finales.push(s); },
        cancelar: async () => { e.canceladas++; return true; } },
    };
    return { e, correr: () => procesarAvisos(deps) };
  };
  const AVISO = { estado: "aceptado_proveedor", aceptado: "2026-11-27T11:00:00Z" }; // 08:00

  await caso("Sin respuesta: avisa con la hora límite; una hora después cancela y avisa al equipo", async () => {
    const a = armar(fila(), "2026-11-27T11:00:00Z"); await a.correr(); assert.deepEqual(a.e.enviados, ["09:00"]); assert.equal(a.e.canceladas, 0);
    const b = armar(fila({}, AVISO), "2026-11-27T12:00:00Z"); await b.correr(); assert.equal(b.e.canceladas, 1); assert.equal(b.e.notificado, 1);
  });
  await caso("No cancela si escribió, si hay abono, si la cita cambió, si ya está confirmada o si el aviso falló", async () => {
    for (const [f, o] of [[fila({}, AVISO), { respondio: true }], [fila({ deposit_amount: 5000 }, AVISO), {}], [fila({ updated_at: "2026-11-27T10:30:00Z" }, AVISO), {}],
      [fila({ status: "confirmed" }, AVISO), {}], [fila({}, { estado: "fallido", aceptado: null }), {}], [fila({}, { estado: "incierto", aceptado: null }), {}], [fila({}, AVISO), { activo: false }]] as const) {
      const a = armar(f, "2026-11-27T12:00:00Z", o); await a.correr(); assert.equal(a.e.canceladas, 0); assert.equal(a.e.enviados.length, 0);
    }
  });
  await caso("Si Meta rechaza el aviso (plantilla sin aprobar), queda como fallido", async () => {
    const a = armar(fila(), "2026-11-27T11:00:00Z", { envio: "fallido" }); await a.correr(); assert.deepEqual(a.e.finales, ["fallido"]);
  });
  await caso("De madrugada no hace nada", async () => {
    const a = armar(fila({}, AVISO), "2026-11-27T07:00:00Z"); await a.correr(); assert.equal(a.e.canceladas + a.e.enviados.length, 0);
  });
  console.log(`OK ${casos} casos de aviso y cancelación; sin red, base ni llaves.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
