// Aviso de consulta al dueño por WhatsApp. Un mensaje normal solo llega si el dueño escribió en las últimas 24 h;
// pasado ese plazo se usa una plantilla aprobada por Meta (utilidad), que llega siempre.
import type { ResultadoEnvioPlantilla } from "./whatsapp-meta";

/** Incluye la pregunta del cliente: el dueño la lee y responde de inmediato. */
export const PLANTILLA_CONSULTA_TEXTO = "aviso_consulta_cliente";
/** Respaldo sin la pregunta (mientras Meta no apruebe la anterior). */
export const PLANTILLA_CONSULTA = "aviso_consulta_pendiente";
export const IDIOMA_PLANTILLA_CONSULTA = "es";
/** Margen de una hora bajo las 24 h de Meta. */
export const VENTANA_DUENO_MS = 23 * 3600000;

export const ventanaAbierta = (ultimoMensaje: string | null | undefined, ahora: number) => {
  const t = Date.parse(String(ultimoMensaje ?? ""));
  return Number.isFinite(t) && ahora - t < VENTANA_DUENO_MS;
};

/** La pregunta como variable de plantilla: Meta no admite saltos de línea. */
export const preguntaParaPlantilla = (pregunta: string, imagen: boolean) =>
  imagen ? "Envió una imagen (escribe consultas para verla)" : pregunta.replace(/\s+/g, " ").trim().slice(0, 500);

export async function conRespaldo(principal: () => Promise<ResultadoEnvioPlantilla>, respaldo: () => Promise<ResultadoEnvioPlantilla>): Promise<ResultadoEnvioPlantilla> {
  const r = await principal();
  return r.estado === "fallido" ? respaldo() : r;
}

/** Fuera de la ventana: plantilla; si Meta la rechaza (p. ej. aún sin aprobar), se intenta el mensaje normal como siempre. */
export async function avisarDueno(abierta: boolean, envios: { normal: () => Promise<ResultadoEnvioPlantilla>; plantilla: () => Promise<ResultadoEnvioPlantilla> }): Promise<{ envio: ResultadoEnvioPlantilla; porPlantilla: boolean }> {
  if (!abierta) {
    const envio = await envios.plantilla();
    if (envio.estado !== "fallido") return { envio, porPlantilla: true };
  }
  return { envio: await envios.normal(), porPlantilla: false };
}
