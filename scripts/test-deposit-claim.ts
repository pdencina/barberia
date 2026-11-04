// Dos avisos del mismo pago no se pisan, y dos reservas del mismo horario no se cruzan. Uso: npx tsx scripts/test-deposit-claim.ts
import assert from "node:assert/strict";
import { decidirReclamo, reclamarPago, SEGUNDOS_PROCESANDO } from "../src/lib/deposit-claim";
import { perdioCarrera } from "../src/lib/deposit-hold";
let fails = 0;
const t = (n: string, f: () => void | Promise<void>) => Promise.resolve().then(f).then(() => console.log("OK  " + n), (e: any) => { fails++; console.log("MAL " + n + ": " + e.message); });

const ahora = Date.parse("2026-11-04T12:00:00Z");
const hace = (s: number) => new Date(ahora - s * 1000).toISOString();

// Una «tabla booking_deposits» en memoria con restricción de pago único, para simular avisos simultáneos de verdad.
function tablaPagos() {
  const filas = new Map<string, any>();
  const cliente: any = {
    from: () => ({
      insert: async (f: any) => { if (filas.has(f.payment_id)) return { error: { code: "23505", message: "duplicate key value violates unique constraint" } }; filas.set(f.payment_id, { ...f, created_at: new Date().toISOString() }); return { error: null }; },
      select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: filas.get(id) ?? null, error: null }) }) }),
      update: (cambios: any) => { const filtros: Record<string, any> = {}; const q: any = { eq: (c: string, v: any) => { filtros[c] = v; return q; }, select: async () => { const r = filas.get(filtros.payment_id); if (!r || r.status !== filtros.status || r.created_at !== filtros.created_at) return { data: [], error: null }; Object.assign(r, cambios); return { data: [{ payment_id: r.payment_id }], error: null }; } }; return q; },
    }),
  };
  return { filas, cliente };
}

(async () => {
  await t("decide: primer aviso toma, repetido descarta, trabado se retoma, intento anterior sin aprobar se procesa", () => {
    assert.equal(decidirReclamo(null, ahora), "tomar");
    for (const s of ["approved", "needs_refund", "refunded"]) assert.equal(decidirReclamo({ status: s, created_at: hace(5) }, ahora), "descartar", s);
    assert.equal(decidirReclamo({ status: "processing", created_at: hace(5) }, ahora), "descartar");
    assert.equal(decidirReclamo({ status: "processing", created_at: hace(SEGUNDOS_PROCESANDO + 5) }, ahora), "retomar");
    assert.equal(decidirReclamo({ status: "pending:pending_waiting_payment", created_at: hace(60) }, ahora), "retomar");
  });
  await t("tres avisos SIMULTÁNEOS del mismo pago: solo uno lo procesa (el caso real del 4 de noviembre)", async () => {
    const { cliente } = tablaPagos();
    const r = await Promise.all([1, 2, 3].map(() => reclamarPago(cliente, { tenantId: "t1", paymentId: "186604811959", amount: 1000, email: "a@b.cl" })));
    assert.equal(r.filter(Boolean).length, 1, JSON.stringify(r));
  });
  await t("un aviso posterior de un pago ya procesado se descarta", async () => {
    const { cliente, filas } = tablaPagos();
    assert.equal(await reclamarPago(cliente, { tenantId: "t1", paymentId: "1", amount: 1000, email: null }), true);
    filas.get("1").status = "approved";
    assert.equal(await reclamarPago(cliente, { tenantId: "t1", paymentId: "1", amount: 1000, email: null }), false);
  });
  await t("un intento anterior sin aprobar no impide procesar el pago aprobado (y solo uno lo retoma)", async () => {
    const { cliente, filas } = tablaPagos();
    filas.set("2", { payment_id: "2", status: "pending:pending_waiting_payment", created_at: hace(30) });
    const r = await Promise.all([1, 2].map(() => reclamarPago(cliente, { tenantId: "t1", paymentId: "2", amount: 1000, email: null })));
    assert.equal(r.filter(Boolean).length, 1);
  });
  await t("sin la tabla (migración 131 pendiente) se sigue procesando como antes", async () => {
    const cliente: any = { from: () => ({ insert: async () => ({ error: { code: "42P01", message: "relation does not exist" } }) }) };
    assert.equal(await reclamarPago(cliente, { tenantId: "t1", paymentId: "3", amount: 1, email: null }), true);
  });

  // --- carrera de horarios: gana la cita creada primero ---
  const base = { barberId: "b1", tenantId: null as string | null, date: "2026-11-07", start: new Date("2026-11-07T11:00:00Z"), end: new Date("2026-11-07T12:30:00Z") };
  const otras = (rows: any[]): any => ({ from: () => { const q: any = new Proxy({}, { get: (_o, p: string) => (p === "then" ? (res: any) => res({ data: rows, error: null }) : () => q) }); return q; } });
  await t("si ya había otra cita en ese horario creada ANTES, esta pierde", async () => { assert.equal(await perdioCarrera(otras([{ id: "otra", created_at: "2026-11-04T05:00:00Z" }]), { ...base, appointmentId: "mia", createdAt: "2026-11-04T05:00:05Z" }), true); });
  await t("si la otra cita se creó DESPUÉS, esta gana (la otra será la que pierda)", async () => { assert.equal(await perdioCarrera(otras([{ id: "otra", created_at: "2026-11-04T05:00:09Z" }]), { ...base, appointmentId: "mia", createdAt: "2026-11-04T05:00:05Z" }), false); });
  await t("sin otras citas, no hay cruce", async () => { assert.equal(await perdioCarrera(otras([]), { ...base, appointmentId: "mia", createdAt: "2026-11-04T05:00:05Z" }), false); });
  await t("empate exacto: gana la de id menor, siempre la misma para los dos", async () => {
    const f = "2026-11-04T05:00:05Z";
    assert.equal(await perdioCarrera(otras([{ id: "a", created_at: f }]), { ...base, appointmentId: "b", createdAt: f }), true);
    assert.equal(await perdioCarrera(otras([{ id: "b", created_at: f }]), { ...base, appointmentId: "a", createdAt: f }), false);
  });
  process.exit(fails ? 1 : 0);
})();
