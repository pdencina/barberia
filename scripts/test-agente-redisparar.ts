import assert from "node:assert/strict";
import { redisparar, type DepsRedisparo } from "../src/lib/agente/redisparar";
import { tocaConfirmar } from "../src/lib/agente/horario-confirmacion";
import { etiquetasDe } from "../src/lib/agente/resumen";

async function main() {
  const p = (d: number, h: string) => Date.parse(`2026-11-${d}T${h}:00.000Z`);
  for (const h of ["16:00", "17:30", "18:00", "20:00", "20:45"]) {
    assert.equal(tocaConfirmar(p(27, h), p(26, "12:00"), p(27, "09:55")), false, h);
    assert.equal(tocaConfirmar(p(27, h), p(26, "12:00"), p(27, "10:00")), true, h);
  }
  assert.equal(tocaConfirmar(p(27, "18:00"), p(26, "22:00"), p(26, "22:05")), true); // reservada de noche: al momento, como antes
  assert.equal(tocaConfirmar(p(27, "15:45"), p(26, "12:00"), p(27, "08:00")), true); // fuera del rango: 8 horas antes
  assert.equal(tocaConfirmar(p(27, "18:00"), p(27, "09:00"), p(27, "10:00")), true); // reservada hoy: como antes (8 h)

  const m = (texto: string, h: string) => ({ contact_hash: "a", direccion: "saliente" as const, tipo: "texto", texto, created_at: `2026-11-27T${h}:00Z` });
  const ahora = p(27, "15:00");
  assert.ok(etiquetasDe([m("Te contactará una persona.", "12:00")], false, ahora).includes("persona"));
  assert.ok(!etiquetasDe([m("Te contactará una persona.", "12:00"), m("[cerrado]", "13:00")], false, ahora).includes("persona"));

  const base = (x: Partial<DepsRedisparo> = {}) => {
    const log: string[] = [];
    const d: DepsRedisparo = { ahora: () => ahora, sal: "s",
      cita: async () => ({ id: "c", tenant_id: "t", status: "scheduled", start_time: "2026-11-27T20:00:00.000Z", date: "2026-11-27", reminder_sent: false, client: { id: "x", tenant_id: "t", name: "Ana", phone: "+56911112222", email: null }, barber: null, services: [] }),
      entrega: async () => ({ id: "e", provider_accepted_at: "2026-11-27T13:00:00Z" }), baja: async () => false,
      reclamar: async () => true, devolver: async () => { log.push("devolver"); }, consumirCuota: async () => true,
      enviar: async () => { log.push("enviar"); return { estado: "aceptado", id: "w" }; }, anotar: async (_e, id) => { log.push(`anotar ${id}`); }, ...x };
    return { d, log };
  };
  const ok = base(); assert.deepEqual(await redisparar("c", "t", ok.d), { ok: true }); assert.deepEqual(ok.log, ["enviar", "anotar w"]);
  for (const [x, status] of [[{ entrega: async () => ({ id: "e", provider_accepted_at: "2026-11-27T14:30:00Z" }) }, 429], [{ baja: async () => true }, 409], [{ reclamar: async () => false }, 409], [{ consumirCuota: async () => false }, 402], [{ entrega: async () => null }, 409], [{ ahora: () => Date.parse("2026-11-27T05:00:00Z") }, 409]] as const) {
    const t = base(x as any), r = await redisparar("c", "t", t.d); assert.equal(!r.ok && r.status, status); assert.ok(!t.log.includes("enviar"));
  }
  assert.equal((await redisparar("c", "otro", base().d) as any).status, 404);
  const f = base({ enviar: async () => ({ estado: "fallido" }) }); await redisparar("c", "t", f.d); assert.deepEqual(f.log, ["devolver"]);
  console.log("re-disparar, cerrar y regla de las 10: OK");
}
main();
