// Tope mensual de correos de difusion, periodo de prueba (con primer mes gratis para negocios nuevos) y cupo del correo "califica".
// Base simulada y fecha de "hoy" inyectada: sin red, sin Supabase, sin llaves, sin depender del reloj.
// Ejecutar: npx tsx scripts/test-tope-difusion.ts
import assert from "node:assert/strict";
import { tryConsumeQuota, getBroadcastStatus, getModoTope, modoPrueba, TOPE_DIFUSION_CORREOS, FECHA_INICIO_TOPE } from "../src/lib/message-quota";

interface Estado { tenant: Record<string, any>; plan: Record<string, any>; usage: any[]; hoy: string; sinColumna?: boolean }
function fakeDb(estado: Estado): any {
  const ahoraIso = `${estado.hoy}T12:00:00Z`;
  return {
    from(tabla: string) {
      const filtros: [string, any][] = []; const distintos: [string, any][] = [];
      let columnas = "", head = false, uno = false, quizas = false, desde: string | null = null;
      const q: any = {
        select: (c: string, o?: any) => { columnas = c; head = !!o?.head; return q; },
        eq: (k: string, v: any) => { filtros.push([k, v]); return q; },
        neq: (k: string, v: any) => { distintos.push([k, v]); return q; },
        gte: (_k: string, v: string) => { desde = v; return q; },
        limit: () => q, single: () => { uno = true; return q; }, maybeSingle: () => { quizas = true; return q; },
        insert: (fila: any) => { estado.usage.push({ ...fila, created_at: ahoraIso }); return Promise.resolve({ error: null }); },
        then: (resolve: any) => {
          if (tabla === "tenants") {
            if (estado.sinColumna && columnas.includes("broadcast_email_quota_override")) return resolve({ data: null, error: { code: "42703" } });
            const t = { ...estado.tenant }; if (estado.sinColumna) delete t.broadcast_email_quota_override;
            return resolve({ data: t, error: null });
          }
          if (tabla === "plan_limits") return resolve({ data: estado.plan, error: null });
          const filas = estado.usage.filter((r) => filtros.every(([k, v]) => r[k] === v) && distintos.every(([k, v]) => r[k] !== v) && (desde === null || r.created_at >= desde));
          if (head) return resolve({ count: filas.length, error: null });
          if (quizas || uno) return resolve({ data: filas[0] ?? null, error: null });
          return resolve({ data: filas, error: null });
        },
      };
      return q;
    },
  };
}
const T = "negocio-1";
// Fechas de referencia: negocio creado el 10-ene-2026.
const ENFORZADO = "2027-02-15"; // ciclo desde 2027-02-10: ya aplica el tope
const PRUEBA = "2026-11-20";    // antes de FECHA_INICIO_TOPE: periodo de prueba
const nuevo = (hoy: string, over: { tenant?: any; plan?: any; usage?: any[]; sinColumna?: boolean } = {}): Estado => ({
  hoy,
  tenant: { id: T, plan: "pro", created_at: "2026-01-10T12:00:00Z", whatsapp_quota_override: null, email_quota_override: null, broadcast_email_quota_override: null, ...(over.tenant ?? {}) },
  plan: { whatsapp_quota: 500, email_quota: 600, ...(over.plan ?? {}) },
  usage: over.usage ?? [], sinColumna: over.sinColumna,
});
const filas = (hoy: string, n: number, channel: string, category: string) => Array.from({ length: n }, () => ({ tenant_id: T, channel, category, reference_id: null, created_at: `${hoy}T12:00:00Z` }));
let casos = 0;
const caso = async (nombre: string, fn: () => Promise<void> | void) => { casos++; try { await fn(); } catch (e) { throw new Error(`${nombre}: ${e instanceof Error ? e.message : "fallo"}`); } };
const consumir = (db: any, hoy: string, canal: "email" | "whatsapp", cat: any, ref?: string) => tryConsumeQuota(T, canal, cat, ref, db, hoy);

(async () => {
  await caso("constantes: 350 y 1 de diciembre de 2026", () => { assert.equal(TOPE_DIFUSION_CORREOS, 350); assert.equal(FECHA_INICIO_TOPE, "2026-12-01"); });

  // ---- tope aplicado (despues del periodo de prueba)
  await caso("difusion: el correo 350 pasa y el 351 no", async () => {
    const e = nuevo(ENFORZADO, { usage: filas(ENFORZADO, 349, "email", "retention") }), db = fakeDb(e);
    assert.equal(await consumir(db, ENFORZADO, "email", "retention"), true);
    assert.equal(await consumir(db, ENFORZADO, "email", "retention"), false);
    assert.equal(e.usage.filter((r) => r.category === "retention").length, 350);
  });
  await caso("el tope de difusion no bloquea confirmaciones ni recordatorios", async () => {
    const db = fakeDb(nuevo(ENFORZADO, { usage: filas(ENFORZADO, 350, "email", "retention") }));
    assert.equal(await consumir(db, ENFORZADO, "email", "confirmation", "cita-1"), true);
    assert.equal(await consumir(db, ENFORZADO, "email", "reminder", "cita-2"), true);
  });
  await caso("el cupo general del plan sigue mandando sobre la difusion", async () => {
    const db = fakeDb(nuevo(ENFORZADO, { plan: { email_quota: 100 }, usage: filas(ENFORZADO, 100, "email", "confirmation") }));
    assert.equal(await consumir(db, ENFORZADO, "email", "retention"), false);
  });
  await caso("sin tope (-1): pasan mas de 350 si el cupo general lo permite", async () => {
    const db = fakeDb(nuevo(ENFORZADO, { tenant: { broadcast_email_quota_override: -1, email_quota_override: 100000 }, usage: filas(ENFORZADO, 400, "email", "retention") }));
    assert.equal(await consumir(db, ENFORZADO, "email", "retention"), true);
    const s = await getBroadcastStatus(T, db, ENFORZADO); assert.equal(s!.limit, null); assert.equal(s!.remaining, null);
  });
  await caso("tope propio del negocio (50)", async () => {
    const db = fakeDb(nuevo(ENFORZADO, { tenant: { broadcast_email_quota_override: 50 }, usage: filas(ENFORZADO, 50, "email", "retention") }));
    assert.equal(await consumir(db, ENFORZADO, "email", "retention"), false);
    const s = await getBroadcastStatus(T, db, ENFORZADO); assert.deepEqual([s!.limit, s!.used, s!.remaining], [50, 50, 0]);
  });
  await caso("falta la columna (migracion 126 sin aplicar): rige el 350 y el negocio se encuentra", async () => {
    const db = fakeDb(nuevo(ENFORZADO, { sinColumna: true, usage: filas(ENFORZADO, 350, "email", "retention") }));
    assert.equal(await consumir(db, ENFORZADO, "email", "retention"), false);
    assert.equal(await consumir(db, ENFORZADO, "email", "confirmation", "cita-9"), true);
    assert.equal((await getBroadcastStatus(T, db, ENFORZADO))!.limit, 350);
  });
  await caso("el tope de difusion es solo de correos: WhatsApp de retencion no se limita por el", async () => {
    const db = fakeDb(nuevo(ENFORZADO, { plan: { whatsapp_quota: null }, usage: filas(ENFORZADO, 400, "whatsapp", "retention") }));
    assert.equal(await consumir(db, ENFORZADO, "whatsapp", "retention"), true);
  });
  await caso("estado de difusion: usados y restantes", async () => {
    const s = await getBroadcastStatus(T, fakeDb(nuevo(ENFORZADO, { usage: filas(ENFORZADO, 120, "email", "retention") })), ENFORZADO);
    assert.deepEqual([s!.limit, s!.used, s!.remaining], [350, 120, 230]);
  });
  await caso("aplicado: el correo 'califica' cuenta en el cupo general y se bloquea al agotarse", async () => {
    const e = nuevo(ENFORZADO, { plan: { email_quota: 3 }, usage: filas(ENFORZADO, 3, "email", "confirmation") });
    assert.equal(await consumir(fakeDb(e), ENFORZADO, "email", "followup", "cita-5"), false);
    assert.equal(e.usage.filter((r) => r.category === "followup").length, 0);
  });
  await caso("aplicado: el correo 'califica' descuenta una vez por cita", async () => {
    const e = nuevo(ENFORZADO, { plan: { email_quota: 10 } }), db = fakeDb(e);
    assert.equal(await consumir(db, ENFORZADO, "email", "followup", "cita-7"), true);
    assert.equal(await consumir(db, ENFORZADO, "email", "followup", "cita-7"), true);
    assert.equal(e.usage.filter((r) => r.category === "followup").length, 1);
  });
  await caso("aplicado: 'califica' no se limita por el tope de difusion", async () => {
    const db = fakeDb(nuevo(ENFORZADO, { usage: filas(ENFORZADO, 350, "email", "retention") }));
    assert.equal(await consumir(db, ENFORZADO, "email", "followup", "cita-8"), true);
  });

  // ---- periodo de prueba (solo cuenta y avisa)
  await caso("prueba: la difusion no se bloquea aunque pase de 350", async () => {
    const e = nuevo(PRUEBA, { usage: filas(PRUEBA, 400, "email", "retention") });
    assert.equal(await consumir(fakeDb(e), PRUEBA, "email", "retention"), true);
    assert.equal(e.usage.filter((r) => r.category === "retention").length, 401);
  });
  await caso("prueba: el cupo general del plan igual se aplica (era la regla de antes)", async () => {
    const db = fakeDb(nuevo(PRUEBA, { plan: { email_quota: 100 }, usage: filas(PRUEBA, 100, "email", "confirmation") }));
    assert.equal(await consumir(db, PRUEBA, "email", "retention"), false);
  });
  await caso("prueba: 'califica' nunca bloquea y queda registrado", async () => {
    const e = nuevo(PRUEBA, { plan: { email_quota: 3 }, usage: filas(PRUEBA, 3, "email", "confirmation") });
    assert.equal(await consumir(fakeDb(e), PRUEBA, "email", "followup", "cita-20"), true);
    assert.equal(e.usage.filter((r) => r.category === "followup").length, 1);
  });
  await caso("prueba: 'califica' no descuenta del cupo general (no quita correos a las confirmaciones)", async () => {
    const e = nuevo(PRUEBA, { plan: { email_quota: 5 }, usage: [...filas(PRUEBA, 2, "email", "confirmation"), ...filas(PRUEBA, 10, "email", "followup")] });
    assert.equal(await consumir(fakeDb(e), PRUEBA, "email", "confirmation", "cita-21"), true);
  });

  // ---- modo de prueba y primer mes gratis de negocios nuevos
  await caso("negocio existente en noviembre: prueba hasta su primer ciclo desde el 1-dic", async () => {
    assert.deepEqual(await getModoTope(T, fakeDb(nuevo(PRUEBA)), PRUEBA), { prueba: true, bloqueaDesde: "2026-12-10" });
  });
  await caso("negocio existente: el ciclo que parte despues del 1-dic ya aplica el tope", async () => {
    assert.deepEqual(await getModoTope(T, fakeDb(nuevo("2026-12-15")), "2026-12-15"), { prueba: false, bloqueaDesde: null });
  });
  const NUEVO = { created_at: "2027-01-05T12:00:00Z" };
  await caso("negocio nuevo (ene-2027): su primer ciclo completo es gratis, aunque pase de 1-dic", async () => {
    const e = nuevo("2027-01-20", { tenant: NUEVO, usage: filas("2027-01-20", 400, "email", "retention") });
    assert.deepEqual(await getModoTope(T, fakeDb(e), "2027-01-20"), { prueba: true, bloqueaDesde: "2027-02-05" });
    assert.equal(await consumir(fakeDb(e), "2027-01-20", "email", "retention"), true);
  });
  await caso("negocio nuevo: desde su segundo ciclo ya se aplica el tope", async () => {
    const e = nuevo("2027-02-10", { tenant: NUEVO, usage: filas("2027-02-10", 350, "email", "retention") });
    assert.deepEqual(await getModoTope(T, fakeDb(e), "2027-02-10"), { prueba: false, bloqueaDesde: null });
    assert.equal(await consumir(fakeDb(e), "2027-02-10", "email", "retention"), false);
  });
  await caso("negocio creado un dia 31: el ciclo se ajusta en meses cortos", async () => {
    assert.deepEqual(modoPrueba("2026-01-31T15:00:00Z", "2026-10-31"), { prueba: true, bloqueaDesde: "2026-12-31" });
  });
  console.log(`OK ${casos} casos tope de difusion, periodo de prueba y cupo de 'califica'; base simulada, sin red ni llaves.`);
})();
