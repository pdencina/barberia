// Memoria de tema de la IA: qué líneas del CONTEXTO DEL NEGOCIO se usaron en la última respuesta (números, nunca texto del cliente).
// Vive en agent_chat_state (migración 014: etapa "tema") o dentro de los datos de una reserva en curso. Expira como el resto de la memoria.
export const VIGENCIA_TEMA_MIN = 30;
const ids = (v: unknown): number[] => (Array.isArray(v) ? v.filter((n) => Number.isInteger(n) && n >= 1 && n <= 250).slice(0, 3) : []);

export async function leerTema(db: any, tenantId: string, contactHash: string, ahoraMs: number): Promise<number[]> {
  try {
    const r = await db.from("agent_chat_state").select("etapa,datos,expires_at").eq("tenant_id", tenantId).eq("contact_hash", contactHash).maybeSingle();
    if (r.error || !r.data || new Date(r.data.expires_at).getTime() <= ahoraMs) return [];
    return ids(r.data.datos?.tema);
  } catch { return []; }
}

export async function guardarTema(db: any, tenantId: string, contactHash: string, tema: number[], ahoraMs: number): Promise<void> {
  try {
    const nuevo = ids(tema); if (nuevo.length === 0) return;
    const r = await db.from("agent_chat_state").select("etapa,datos,expires_at").eq("tenant_id", tenantId).eq("contact_hash", contactHash).maybeSingle();
    const vigente = !r.error && r.data && new Date(r.data.expires_at).getTime() > ahoraMs;
    if (vigente && r.data.etapa !== "tema") {
      // Hay una reserva en curso: se conserva y solo se agrega el tema a sus datos.
      await db.from("agent_chat_state").update({ datos: { ...(r.data.datos ?? {}), tema: nuevo }, updated_at: new Date(ahoraMs).toISOString() }).eq("tenant_id", tenantId).eq("contact_hash", contactHash);
      return;
    }
    await db.from("agent_chat_state").upsert({ tenant_id: tenantId, contact_hash: contactHash, etapa: "tema", datos: { tema: nuevo }, expires_at: new Date(ahoraMs + VIGENCIA_TEMA_MIN * 60000).toISOString(), updated_at: new Date(ahoraMs).toISOString() }, { onConflict: "tenant_id,contact_hash" });
  } catch { /* sin memoria de tema: la IA responde como antes */ }
}
