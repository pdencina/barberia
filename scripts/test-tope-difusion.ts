// Tope mensual de correos de difusion y cupo del correo "califica". Base simulada: sin red, sin Supabase, sin llaves.
// Ejecutar: npx tsx scripts/test-tope-difusion.ts
import assert from "node:assert/strict";
import { tryConsumeQuota, getBroadcastStatus, TOPE_DIFUSION_CORREOS } from "../src/lib/message-quota";

interface Estado { tenant: Record<string, any>; plan: Record<string, any>; usage: any[]; sinColumna?: boolean }
function fakeDb(estado: Estado): any {
  return {
    from(tabla: string) {
      const filtros: [string, any][] = []; let columnas = "", head = false, uno = false, quizas = false, desde: string | null = null;
      const q: any = {
        select: (c: string, o?: any) => { columnas = c; head = !!o?.head; return q; },
        eq: (k: string, v: any) => { filtros.push([k, v]); return q; },
        gte: (_k: string, v: string) => { desde = v; return q; },
        limit: () => q, single: () => { uno = true; return q; }, maybeSingle: () => { quizas = true; return q; },
        insert: (fila: any) => { estado.usage.push({ ...fila, created_at: new Date().toISOString() }); return Promise.resolve({ error: null }); },
        then: (resolve: any) => {
          if (tabla === "tenants") {
            if (estado.sinColumna && columnas.includes("broadcast_email_quota_override")) return resolve({ data: null, error: { code: "42703" } });
            const t = { ...estado.tenant }; if (estado.sinColumna) delete t.broadcast_email_quota_override;
            return resolve({ data: t, error: null });
          }
          if (tabla === "plan_limits") return resolve({ data: estado.plan, error: null });
          const filas = estado.usage.filter((r) => filtros.every(([k, v]) => r[k] === v) && (desde === null || r.created_at >= desde));
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
const nuevo = (over: Partial<Estado> & { tenant?: any; plan?: any } = {}): Estado => ({
  tenant: { id: T, plan: "pro", created_at: "2026-01-10T12:00:00Z", whatsapp_quota_override: null, email_quota_override: null, broadcast_email_quota_override: null, ...(over.tenant ?? {}) },
  plan: { whatsapp_quota: 500, email_quota: 600, ...(over.plan ?? {}) },
  usage: over.usage ?? [], sinColumna: over.sinColumna,
});
const filas = (n: number, channel: string, category: string) => Array.from({ length: n }, (_, i) => ({ tenant_id: T, channel, category, reference_id: null, created_at: new Date().toISOString(), i }));
let casos = 0;
const caso = async (nombre: string, fn: () => Promise<void>) => { casos++; try { await fn(); } catch (e) { throw new Error(`${nombre}: ${e instanceof Error ? e.message : "fallo"}`); } };

(async () => {
  await caso("el tope por defecto es 350", async () => assert.equal(TOPE_DIFUSION_CORREOS, 350));
  await caso("difusion: el correo 350 pasa y el 351 no", async () => {
    const e = nuevo({ usage: filas(349, "email", "retention") }), db = fakeDb(e);
    assert.equal(await tryConsumeQuota(T, "email", "retention", undefined, db), true);
    assert.equal(await tryConsumeQuota(T, "email", "retention", undefined, db), false);
    assert.equal(e.usage.filter((r) => r.category === "retention").length, 350);
  });
  await caso("el tope de difusion no bloquea confirmaciones ni recordatorios", async () => {
    const db = fakeDb(nuevo({ usage: filas(350, "email", "retention") }));
    assert.equal(await tryConsumeQuota(T, "email", "confirmation", "cita-1", db), true);
    assert.equal(await tryConsumeQuota(T, "email", "reminder", "cita-2", db), true);
  });
  await caso("el cupo general del plan sigue mandando sobre la difusion", async () => {
    const db = fakeDb(nuevo({ plan: { email_quota: 100 }, usage: filas(100, "email", "confirmation") }));
    assert.equal(await tryConsumeQuota(T, "email", "retention", undefined, db), false);
  });
  await caso("sin tope (-1): pasan mas de 350 si el cupo general lo permite", async () => {
    const db = fakeDb(nuevo({ tenant: { broadcast_email_quota_override: -1, email_quota_override: 100000 }, usage: filas(400, "email", "retention") }));
    assert.equal(await tryConsumeQuota(T, "email", "retention", undefined, db), true);
    const s = await getBroadcastStatus(T, db); assert.equal(s!.limit, null); assert.equal(s!.remaining, null);
  });
  await caso("tope propio del negocio (50)", async () => {
    const db = fakeDb(nuevo({ tenant: { broadcast_email_quota_override: 50 }, usage: filas(50, "email", "retention") }));
    assert.equal(await tryConsumeQuota(T, "email", "retention", undefined, db), false);
    const s = await getBroadcastStatus(T, db); assert.equal(s!.limit, 50); assert.equal(s!.used, 50); assert.equal(s!.remaining, 0);
  });
  await caso("falta la columna (migracion 126 sin aplicar): rige el 350 y el negocio se encuentra", async () => {
    const db = fakeDb(nuevo({ sinColumna: true, usage: filas(350, "email", "retention") }));
    assert.equal(await tryConsumeQuota(T, "email", "retention", undefined, db), false);
    assert.equal(await tryConsumeQuota(T, "email", "confirmation", "cita-9", db), true);
    const s = await getBroadcastStatus(T, db); assert.equal(s!.limit, 350);
  });
  await caso("el tope de difusion es solo de correos: WhatsApp de retencion no se limita por el", async () => {
    const db = fakeDb(nuevo({ plan: { whatsapp_quota: null }, usage: filas(400, "whatsapp", "retention") }));
    assert.equal(await tryConsumeQuota(T, "whatsapp", "retention", undefined, db), true);
  });
  await caso("estado de difusion: usados y restantes", async () => {
    const s = await getBroadcastStatus(T, fakeDb(nuevo({ usage: filas(120, "email", "retention") })));
    assert.deepEqual([s!.limit, s!.used, s!.remaining], [350, 120, 230]);
  });
  await caso("el correo 'califica' (followup) cuenta en el cupo general y se bloquea al agotarse", async () => {
    const e = nuevo({ plan: { email_quota: 3 }, usage: filas(3, "email", "confirmation") });
    assert.equal(await tryConsumeQuota(T, "email", "followup", "cita-5", fakeDb(e)), false);
    assert.equal(e.usage.filter((r) => r.category === "followup").length, 0);
  });
  await caso("el correo 'califica' descuenta una vez por cita (mismo id no vuelve a contar)", async () => {
    const e = nuevo({ plan: { email_quota: 10 } }), db = fakeDb(e);
    assert.equal(await tryConsumeQuota(T, "email", "followup", "cita-7", db), true);
    assert.equal(await tryConsumeQuota(T, "email", "followup", "cita-7", db), true);
    assert.equal(e.usage.filter((r) => r.category === "followup").length, 1);
  });
  await caso("el correo 'califica' no se limita por el tope de difusion", async () => {
    const db = fakeDb(nuevo({ usage: filas(350, "email", "retention") }));
    assert.equal(await tryConsumeQuota(T, "email", "followup", "cita-8", db), true);
  });
  console.log(`OK ${casos} casos tope de difusion y cupo de 'califica'; base simulada, sin red ni llaves.`);
})();
