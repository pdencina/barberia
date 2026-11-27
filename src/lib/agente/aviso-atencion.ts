// Aviso en la app cuando un cliente de WhatsApp necesita a una persona. No depende de la ventana de 24 horas de WhatsApp.
import type { NotifyInput } from "../notify";

export function avisoDeAtencion(tenantId: string, caso: { telefono?: string; pregunta?: string; imagen?: boolean } = {}): NotifyInput {
  const fin = String(caso.telefono ?? "").replace(/\D/g, "").slice(-4);
  const quien = fin ? `El cliente terminado en ${fin}` : "Un cliente";
  const texto = String(caso.pregunta ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  const body = caso.imagen ? `${quien} envió una imagen o documento. Abre las conversaciones para responderle.`
    : texto ? `${quien} preguntó: «${texto}»` : `${quien} espera respuesta. Abre las conversaciones.`;
  return { tenantId, kind: "whatsapp_attention", roles: ["admin"], title: "💬 Un cliente necesita atención por WhatsApp", body, url: "/dashboard/whatsapp-chats",
    pushBody: caso.imagen ? body : `${quien} espera respuesta.` };
}
