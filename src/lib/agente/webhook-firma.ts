import { createHmac, timingSafeEqual } from "node:crypto";

// INFERENCIA: contrato genérico solicitado, no integración Meta verificada.
// Meta no accesible (429), consulta 2026-10-26: ver docs/agente/WEBHOOK_FIRMA.md.
// Solo devuelve booleano. No lee entorno, red, hora, identidad ni registra cuerpo/secreto.
export function verificarFirmaWebhook(cabecera: unknown, cuerpoCrudo: unknown, secreto: unknown): boolean {
  if (typeof cabecera !== "string" || cabecera.length !== 71) return false;
  const firma = /^sha256=([0-9a-fA-F]{64})$/.exec(cabecera);
  if (!firma) return false;
  if (typeof cuerpoCrudo !== "string" && !(cuerpoCrudo instanceof Uint8Array)) return false;
  if (typeof secreto !== "string" && !(secreto instanceof Uint8Array)) return false;
  if (typeof secreto === "string" ? secreto.trim().length === 0 : secreto.byteLength === 0) return false;

  try {
    // No parsear JSON, reserializar ni normalizar Unicode: la firma depende de los bytes originales.
    const esperada = createHmac("sha256", secreto).update(cuerpoCrudo).digest();
    const recibida = Buffer.from(firma[1], "hex");
    // Tras validar 64 dígitos hex, ambos buffers tienen 32 bytes.
    return recibida.length === esperada.length && timingSafeEqual(esperada, recibida);
  } catch {
    return false;
  }
}
