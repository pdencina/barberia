// Registro de conversaciones del agente de WhatsApp (solo si el negocio lo encendió: agent_whatsapp_settings.registrar_chats).
// Nunca debe romper la atención: todo es "mejor esfuerzo". Se borra solo a los 14 días.
export const DIAS_CONSERVAR_CHATS = 14;
export type DireccionChat = "entrante" | "saliente";
export type TipoChat = "texto" | "boton" | "imagen" | "documento" | "audio" | "plantilla" | "lista" | "archivo" | "otro";
export interface RegistroChat { tenantId: string; contactHash: string; telefono: string | null; direccion: DireccionChat; tipo: TipoChat; texto: string }

const limpiar = (t: string) => t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, 2000);

/** Tipo de mensaje entrante según lo que mandó el cliente. */
export function tipoEntrante(tipo: string, esBoton: boolean): TipoChat {
  if (esBoton || tipo === "button" || tipo === "interactive") return "boton";
  if (tipo === "text") return "texto";
  if (tipo === "image") return "imagen";
  if (tipo === "document") return "documento";
  if (tipo === "audio" || tipo === "voice") return "audio";
  return "otro";
}

/** Texto a guardar de un mensaje entrante que no es texto (no se guarda el contenido de fotos ni audios). */
export function textoEntrante(tipo: string, texto: string | null): string {
  if (texto && texto.trim()) return texto;
  if (tipo === "image") return "[imagen]";
  if (tipo === "document") return "[documento]";
  if (tipo === "audio" || tipo === "voice") return "[audio]";
  if (tipo === "sticker") return "[sticker]";
  if (tipo === "location") return "[ubicación]";
  return `[${tipo || "mensaje"}]`;
}

const cacheFlag = new Map<string, { v: boolean; hasta: number }>();
/** ¿El negocio guarda conversaciones? (se recuerda 30 s para no consultar en cada mensaje) */
export async function registraChats(db: any, tenantId: string, ahora = Date.now()): Promise<boolean> {
  const c = cacheFlag.get(tenantId); if (c && c.hasta > ahora) return c.v;
  let v = false;
  try { const r = await db.from("agent_whatsapp_settings").select("registrar_chats").eq("tenant_id", tenantId).maybeSingle(); v = !r.error && r.data?.registrar_chats === true; } catch { v = false; }
  cacheFlag.set(tenantId, { v, hasta: ahora + 30000 });
  return v;
}
export const olvidarFlagChats = (tenantId: string) => { cacheFlag.delete(tenantId); };

/** Guarda un mensaje si el negocio lo tiene encendido. Nunca lanza. */
export async function registrarChat(db: any, r: RegistroChat): Promise<void> {
  try {
    if (!r.texto || !(await registraChats(db, r.tenantId))) return;
    await db.from("agent_chats").insert({ tenant_id: r.tenantId, contact_hash: r.contactHash, telefono: r.telefono ? r.telefono.replace(/\D/g, "").slice(0, 15) : null, direccion: r.direccion, tipo: r.tipo, texto: limpiar(r.texto) });
  } catch { /* sin tabla o falla: la atención sigue igual */ }
}

/** Borra lo más viejo que el plazo de conservación. */
export async function purgarChats(db: any, ahora = Date.now()): Promise<void> {
  try { await db.from("agent_chats").delete().lt("created_at", new Date(ahora - DIAS_CONSERVAR_CHATS * 86400000).toISOString()); } catch { /* se intenta en la próxima */ }
}
