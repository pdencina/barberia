import { createHash } from "node:crypto";

export interface DatosClaveEnvio {
  readonly tenantId: string;
  readonly fechaInformada: string;
  readonly finalidad: string;
  readonly canal: "email" | "whatsapp";
}
export interface DatosClaveEvento {
  readonly tenantId: string;
  readonly referenciaProveedor: string;
}
const error = () => new Error("Parámetros de deduplicación inválidos");
const textoValido = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.trim() === v && !/[\u0000-\u001f\u007f]/.test(v);
function fechaValida(v: unknown): v is string {
  if (typeof v !== "string" || v.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  if (y < 1 || m < 1 || m > 12 || d < 1) return false;
  const bisiesto = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return d <= [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}
// INFERENCIA: tupla JSON fija/versionada evita ambigüedad de concatenar campos con separadores.
// Identificadores se reciben canónicos del servidor, sin normalización o lectura externa aquí.
function clave(dominio: string, campos: readonly string[]): string {
  return `${dominio}:${createHash("sha256").update(JSON.stringify([dominio, ...campos]), "utf8").digest("hex")}`;
}
export function crearClaveEnvio(d: DatosClaveEnvio): string {
  if (!d || !textoValido(d.tenantId) || !fechaValida(d.fechaInformada) || !textoValido(d.finalidad) || !["email", "whatsapp"].includes(d.canal)) throw error();
  return clave("agente-envio-v1", [d.tenantId, d.fechaInformada, d.finalidad, d.canal]);
}
export function crearClaveEventoEntrante(d: DatosClaveEvento): string {
  if (!d || !textoValido(d.tenantId) || !textoValido(d.referenciaProveedor)) throw error();
  return clave("agente-entrada-v1", [d.tenantId, d.referenciaProveedor]);
}
