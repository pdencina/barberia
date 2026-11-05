// Referencia corta del pago (Mercado Pago acepta máximo 256 caracteres). Uso: npx tsx scripts/test-booking-intent.ts
import assert from "node:assert/strict";
import { guardarIntento, leerIntento, MAX_REFERENCIA_MP } from "../src/lib/booking-intent";
let fails = 0;
const t = (n: string, f: () => void | Promise<void>) => Promise.resolve().then(f).then(() => console.log("OK  " + n), (e: any) => { fails++; console.log("MAL " + n + ": " + e.message); });

const u = "30c7343c-1ace-4b39-adb5-31ba410c2b51";
const reserva = { barberId: u, clientName: "Nicolás Pérez", clientEmail: "nicoperezj1@gmail.com", clientPhone: "998950727", serviceIds: [u], date: "2026-11-05", startTime: "2026-11-05T08:00:00", notes: null, totalPrice: 18000, depositAmount: 1000, tenantId: u, holdRef: u };

function fake(opts: { insertError?: any; fila?: any }) {
  const guardado: any[] = [];
  return {
    guardado,
    from: () => ({
      insert: (row: any) => { if (!opts.insertError) guardado.push(row); return Promise.resolve({ error: opts.insertError || null }); },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.fila ?? null, error: null }) }) }),
    }),
  };
}

(async () => {
  await t("una reserva normal NO cabe en 256 caracteres (por eso se guarda aparte)", () => { assert.ok(JSON.stringify(reserva).length > MAX_REFERENCIA_MP, String(JSON.stringify(reserva).length)); });
  await t("guarda los datos y devuelve una referencia corta (un UUID)", async () => {
    const db = fake({});
    const ref = await guardarIntento(db, u, reserva);
    assert.match(ref, /^[0-9a-f-]{36}$/); assert.ok(ref.length <= MAX_REFERENCIA_MP);
    assert.equal(db.guardado[0].ref, ref); assert.equal(db.guardado[0].tenant_id, u); assert.deepEqual(db.guardado[0].data, reserva);
  });
  await t("sin la migración y con datos largos: falla con un mensaje claro (no manda una referencia que Mercado Pago rechazaría)", async () => {
    await assert.rejects(() => guardarIntento(fake({ insertError: { message: "relation does not exist" } }), u, reserva), /migración 133/);
  });
  await t("sin la migración pero con datos cortos: usa el formato antiguo", async () => {
    const ref = await guardarIntento(fake({ insertError: { message: "x" } }), u, { a: 1 });
    assert.equal(ref, '{"a":1}');
  });
  await t("lee por referencia corta, y también el JSON antiguo", async () => {
    assert.deepEqual(await leerIntento(fake({ fila: { data: reserva } }), "0ef8674e-186b-41d5-aabb-256bfcaffeb5"), reserva);
    assert.deepEqual(await leerIntento(fake({}), '{"tenantId":"x"}'), { tenantId: "x" });
  });
  await t("referencia vacía, desconocida o rota no devuelve datos", async () => {
    assert.equal(await leerIntento(fake({}), ""), null); assert.equal(await leerIntento(fake({}), null), null);
    assert.equal(await leerIntento(fake({ fila: null }), "0ef8674e-186b-41d5-aabb-256bfcaffeb5"), null);
    assert.equal(await leerIntento(fake({}), "{roto"), null);
  });
  process.exit(fails ? 1 : 0);
})();
