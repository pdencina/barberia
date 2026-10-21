// Pruebas del mensaje de WhatsApp de confirmacion: npx tsx scripts/test-whatsapp-confirm.ts
import assert from "node:assert/strict";
import { renderWhatsAppMessage, DEFAULT_WHATSAPP_CONFIG as C, mergeWhatsAppConfig } from "../src/lib/whatsapp-confirm";

const base = { clientName: "Sebastián Castillo R.", businessName: "Estudio Levels", professionalName: "Nicolás Levels", serviceNames: ["Corte Tijeras Nicolas"], date: "2026-10-20", time: "10:00:00", totalPrice: 20000 };

// Sin configurar queda el mensaje de siempre (y no repite al profesional si ya va en el servicio).
assert.equal(renderWhatsAppMessage(base),
  "Hola Sebastián! Te escribimos desde Estudio Levels para confirmar tu hora de Corte Tijeras Nicolas el martes, 20 de octubre a las 10:00. Nos confirmas si asistirás? Gracias!");
assert.ok(renderWhatsAppMessage({ ...base, serviceNames: ["Corte de cabello"] }).includes("de Corte de cabello con Nicolás Levels el martes"));
// Datos faltantes: no quedan huecos.
assert.equal(renderWhatsAppMessage({ ...base, clientName: "", businessName: "", serviceNames: [], professionalName: "", time: "" }),
  "Hola! Te escribimos para confirmar tu hora el martes, 20 de octubre. Nos confirmas si asistirás? Gracias!");
// Abono, transferencia, bienvenida e informacion solo salen si se piden.
const cfg = { ...C, transfer_text: "Banco X\nCuenta 123", deposit_value: 30 };
assert.ok(!renderWhatsAppMessage(base, cfg).includes("abono"));
const full = renderWhatsAppMessage(base, cfg, { deposit: true, welcome: true, info: true });
assert.ok(full.includes("abono de $6.000") && full.includes("Banco X") && full.startsWith("Bienvenido/a a Estudio Levels"));
// Variables dia / mes.
assert.ok(renderWhatsAppMessage(base, { ...C, confirm_text: "{dia} de {mes} {hora}" }).startsWith("martes 20 de octubre 10:00"));
// Datos guardados incompletos o malos se completan con los de siempre.
assert.equal(mergeWhatsAppConfig({ confirm_text: "   ", deposit_value: -5 }).confirm_text, C.confirm_text);
assert.equal(mergeWhatsAppConfig(null).deposit_enabled, false);
console.log("OK: mensajes de WhatsApp");
