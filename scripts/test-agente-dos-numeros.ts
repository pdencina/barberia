// Dos números de WhatsApp para el mismo negocio: el webhook reconoce ambos y responde desde el que recibió. Sin red ni base real.
// Ejecutar: npx tsx scripts/test-agente-dos-numeros.ts
import assert from "node:assert/strict";
import { crearRepositorioWebhook } from "../src/lib/agente/whatsapp-webhook";

type Fila = { tenant_id: string; phone_number_id: string; phone_number_id_2?: string | null; enabled: boolean };
function db(filas: Fila[], sinColumna = false, falla = false) {
  const consultas: string[] = [];
  return { consultas, db: { from: (_t: string) => ({ select: (cols: string) => ({ eq: (col: string, v: string) => ({ maybeSingle: async () => {
    consultas.push(`${col}=${v}`);
    if (falla && col === "phone_number_id_2") return { data: null, error: { code: "XX000" } };
    if (sinColumna && col === "phone_number_id_2") return { data: null, error: { code: "42703" } };
    const f = filas.find((x) => (x as any)[col] === v);
    return { data: f ? { tenant_id: f.tenant_id, phone_number_id: f.phone_number_id, phone_number_id_2: f.phone_number_id_2, enabled: f.enabled } : null, error: null };
  } }) }) }) } as any };
}
(async () => {
  const filas: Fila[] = [{ tenant_id: "T1", phone_number_id: "111", phone_number_id_2: "222", enabled: true }];
  { const x = db(filas); const r = crearRepositorioWebhook(x.db, "sal");
    assert.deepEqual(await r.negocio("111"), { tenantId: "T1", phoneNumberId: "111", enabled: true }, "el principal funciona igual que antes");
    assert.deepEqual(x.consultas, ["phone_number_id=111"], "el principal no hace la segunda consulta"); }
  { const x = db(filas); const r = crearRepositorioWebhook(x.db, "sal");
    assert.deepEqual(await r.negocio("222"), { tenantId: "T1", phoneNumberId: "222", enabled: true }, "el segundo atiende y responde desde sí mismo"); }
  { const r = crearRepositorioWebhook(db(filas).db, "sal"); assert.equal(await r.negocio("999"), null, "un número desconocido no se atiende"); }
  { const r = crearRepositorioWebhook(db([{ ...filas[0], enabled: false }]).db, "sal");
    assert.equal((await r.negocio("222"))?.enabled, false, "si el negocio está apagado, el segundo también"); }
  { const r = crearRepositorioWebhook(db(filas, true).db, "sal");
    assert.equal(await r.negocio("222"), null, "sin la migración 018 no hay segundo número y no falla");
    assert.deepEqual(await r.negocio("111"), { tenantId: "T1", phoneNumberId: "111", enabled: true }, "el principal sigue funcionando sin la migración"); }
  { const r = crearRepositorioWebhook(db(filas, false, true).db, "sal");
    await assert.rejects(() => r.negocio("222"), /no disponible/, "un error real falla cerrado (no atiende)"); }
  console.log("OK 6 casos de dos números; sin red ni base real.");
})().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
