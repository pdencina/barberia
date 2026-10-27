export interface EventoUso {
  readonly tenantId: string;
  readonly contactHash: string;
  readonly messageHash: string;
  readonly atMs: number;
}
export interface ReglaVentana {
  readonly max: number;
  readonly ventanaMs: number;
}
export interface EntradaLimiteUso {
  readonly tenantId: string;
  readonly contactHash: string;
  readonly messageHash: string;
  readonly ahoraMs: number;
  readonly historial: readonly EventoUso[];
  readonly reglas: { readonly contacto: ReglaVentana; readonly negocio: ReglaVentana; readonly bucle: ReglaVentana };
}
export type MotivoLimite = "datos_invalidos" | "limite_contacto" | "limite_negocio" | "bucle";
export interface ResultadoLimiteUso {
  permitido: boolean;
  motivos: MotivoLimite[];
  conteos: { contacto: number; negocio: number; repetidos: number };
}

const entero = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const hash = (v: unknown): v is string => typeof v === "string" && v.length === 64 && /^[a-f0-9]{64}$/i.test(v);
const tenant = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.trim() === v;
const reglaValida = (r: ReglaVentana): boolean => !!r && entero(r.max) && entero(r.ventanaMs) && r.ventanaMs > 0;
const invalido = (): ResultadoLimiteUso => ({ permitido: false, motivos: ["datos_invalidos"], conteos: { contacto: 0, negocio: 0, repetidos: 0 } });

// INFERENCIA: evaluación genérica, sin valores de producto por defecto (Nico decide pregunta 12).
// Ventana (ahora - ventanaMs, ahora]; conteos históricos ANTES de incorporar el mensaje candidato.
// Historial de entrantes completos/deduplicados suministrado por servidor; no consulta ni persiste.
export function evaluarLimiteDeUso(e: EntradaLimiteUso): ResultadoLimiteUso {
  if (!e || !tenant(e.tenantId) || !hash(e.contactHash) || !hash(e.messageHash) || !entero(e.ahoraMs) || !Array.isArray(e.historial)) return invalido();
  if (!e.reglas || !reglaValida(e.reglas.contacto) || !reglaValida(e.reglas.negocio) || !reglaValida(e.reglas.bucle)) return invalido();
  const conteos = { contacto: 0, negocio: 0, repetidos: 0 };
  for (const ev of e.historial) {
    if (!ev || !tenant(ev.tenantId) || !hash(ev.contactHash) || !hash(ev.messageHash) || !entero(ev.atMs)) return invalido();
    if (ev.tenantId !== e.tenantId || ev.atMs > e.ahoraMs) continue;
    if (ev.atMs > e.ahoraMs - e.reglas.negocio.ventanaMs) conteos.negocio++;
    if (ev.contactHash.toLowerCase() !== e.contactHash.toLowerCase()) continue;
    if (ev.atMs > e.ahoraMs - e.reglas.contacto.ventanaMs) conteos.contacto++;
    if (ev.messageHash.toLowerCase() === e.messageHash.toLowerCase() && ev.atMs > e.ahoraMs - e.reglas.bucle.ventanaMs) conteos.repetidos++;
  }
  const motivos: MotivoLimite[] = [];
  if (conteos.contacto >= e.reglas.contacto.max) motivos.push("limite_contacto");
  if (conteos.negocio >= e.reglas.negocio.max) motivos.push("limite_negocio");
  if (conteos.repetidos >= e.reglas.bucle.max) motivos.push("bucle");
  return { permitido: motivos.length === 0, motivos, conteos };
}
