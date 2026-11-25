// Registro de conversaciones del agente: solo si el negocio lo enciende, mejor esfuerzo, texto saneado. Sin red ni base real.
// Ejecutar: npx tsx scripts/test-agente-chats.ts
import assert from "node:assert/strict";
import { registrarChat, registraChats, olvidarFlagChats, purgarChats, tipoEntrante, textoEntrante, DIAS_CONSERVAR_CHATS } from "../src/lib/agente/chats";
import { textoPlantillaConfirmacion } from "../src/lib/agente/plantilla-recordatorio";

let casos = 0;
const caso = async (n: string, f: () => Promise<void> | void) => { casos++; try { await f(); } catch (e) { throw new Error(`${n}: ${e instanceof Error ? e.message : "fallo"}`); } };
function bd(flag: boolean | "error") {
  const e = { inserts: [] as any[], borrados: [] as string[], lecturas: 0 };
  const db: any = { from: (t: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => { e.lecturas++; return flag === "error" ? { data: null, error: { code: "42703" } } : { data: { registrar_chats: flag }, error: null }; } }) }),
    insert: async (r: any) => { if (t === "agent_chats") e.inserts.push(r); return { error: null }; },
    delete: () => ({ lt: async (_c: string, v: string) => { e.borrados.push(v); return { error: null }; } }),
  }) };
  return { e, db };
}
const base = { tenantId: "T", contactHash: "abc", telefono: "+56 9 1111-2222", direccion: "entrante" as const, tipo: "texto" as const, texto: "hola" };

(async () => {
  await caso("Apagado (por defecto): no guarda nada", async () => { olvidarFlagChats("T"); const a = bd(false); await registrarChat(a.db, base); assert.equal(a.e.inserts.length, 0); });
  await caso("Encendido: guarda el mensaje con teléfono solo en dígitos", async () => {
    olvidarFlagChats("T"); const a = bd(true); await registrarChat(a.db, base);
    assert.equal(a.e.inserts.length, 1); assert.equal(a.e.inserts[0].telefono, "56911112222"); assert.equal(a.e.inserts[0].texto, "hola"); assert.equal(a.e.inserts[0].direccion, "entrante");
  });
  await caso("Recuerda el interruptor 30 s (no consulta en cada mensaje) y lo olvida al cambiarlo", async () => {
    olvidarFlagChats("T"); const a = bd(true); await registrarChat(a.db, base); await registrarChat(a.db, base); await registrarChat(a.db, base);
    assert.equal(a.e.lecturas, 1); olvidarFlagChats("T"); await registraChats(a.db, "T"); assert.equal(a.e.lecturas, 2);
  });
  await caso("Falla de la base o falta de migración: nunca lanza y no guarda", async () => {
    olvidarFlagChats("T"); const a = bd("error"); await registrarChat(a.db, base); assert.equal(a.e.inserts.length, 0);
    olvidarFlagChats("T"); const b: any = { from: () => { throw new Error("caída"); } }; await registrarChat(b, base);
  });
  await caso("Saneado y tope: sin caracteres de control y máximo 2000 letras; texto vacío no se guarda", async () => {
    olvidarFlagChats("T"); const a = bd(true);
    await registrarChat(a.db, { ...base, texto: "ho\u0000la\u0007" + "x".repeat(3000) }); await registrarChat(a.db, { ...base, texto: "" });
    assert.equal(a.e.inserts.length, 1); assert.equal(a.e.inserts[0].texto.length, 2000); assert.ok(!/[\u0000-\u0008]/.test(a.e.inserts[0].texto));
  });
  await caso("Purga: borra lo más viejo que el plazo", async () => {
    const a = bd(true); const ahora = Date.UTC(2026, 10, 25); await purgarChats(a.db, ahora);
    assert.equal(a.e.borrados[0], new Date(ahora - DIAS_CONSERVAR_CHATS * 86400000).toISOString()); assert.equal(DIAS_CONSERVAR_CHATS, 14);
  });
  await caso("Tipos y textos entrantes: fotos y audios no guardan su contenido, solo una marca", () => {
    assert.equal(tipoEntrante("text", false), "texto"); assert.equal(tipoEntrante("button", false), "boton"); assert.equal(tipoEntrante("interactive", true), "boton");
    assert.equal(tipoEntrante("image", false), "imagen"); assert.equal(tipoEntrante("voice", false), "audio");
    assert.equal(textoEntrante("image", null), "[imagen]"); assert.equal(textoEntrante("audio", null), "[audio]"); assert.equal(textoEntrante("text", "hola"), "hola");
  });
  await caso("El texto guardado de la confirmación calza con la plantilla aprobada", () => {
    const v = ["Amaro", "Estudio Levels", "Solo corte", "Nicolas", "miércoles, 25 de noviembre", "08:30"];
    assert.ok(textoPlantillaConfirmacion(true, v).startsWith("Hola Amaro! Te escribimos desde Estudio Levels para confirmar tu hora de Solo corte con Nicolas el miércoles, 25 de noviembre a las 08:30. ¿Nos confirmas si asistirás? ¡Gracias!"));
    assert.ok(textoPlantillaConfirmacion(false, v).startsWith("Hola Amaro! Tu hora en Estudio Levels quedó agendada: Solo corte con Nicolas"));
  });
  console.log(`OK ${casos} casos del registro de conversaciones; sin red ni base real.`);
})().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
