// Lectura de la base para el resumen. Siempre filtrado por el negocio.
import { fetchAllRows } from "../accounting";
import { ahoraChile } from "./disponibilidad";
import { resumirDia, textoResumen, type MensajeResumen, type Salud } from "./resumen";

export async function consultasAbiertas(db: any, tenantId: string, ahora: number): Promise<Set<string>> {
  const r = await db.from("agent_consultas").select("contact_hash").eq("tenant_id", tenantId).gte("created_at", new Date(ahora - 48 * 3600000).toISOString()).limit(100);
  return new Set(r.error ? [] : ((r.data ?? []) as any[]).map((x) => String(x.contact_hash)));
}

export async function saludDelDia(db: any, tenantId: string, ahora: number): Promise<Salud> {
  const dia = ahoraChile(ahora).fecha, desde = new Date(ahora - 30 * 3600000).toISOString();
  const deHoy = async (tabla: string, columnas: string, fecha: string, filtro: (q: any) => any): Promise<any[]> => {
    const r = await filtro(db.from(tabla).select(columnas).eq("tenant_id", tenantId).gte(fecha, desde)).limit(1000);
    if (r.error) throw new Error("resumen");
    return (r.data ?? []).filter((x: any) => ahoraChile(Date.parse(x[fecha])).fecha === dia);
  };
  const [clientes, reservas, eventos, envios, ultimo] = await Promise.all([
    deHoy("clients", "created_at", "created_at", (q) => q),
    deHoy("appointments", "created_at", "created_at", (q) => q.eq("source", "whatsapp_agente")),
    deHoy("agent_whatsapp_events", "received_at", "received_at", (q) => q.eq("status", "fallido")),
    deHoy("agent_reminder_deliveries", "created_at", "created_at", (q) => q.eq("channel", "whatsapp").eq("status", "fallido")),
    db.from("agent_whatsapp_events").select("received_at").eq("tenant_id", tenantId).order("received_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return { clientesNuevos: clientes.length, reservasAgente: reservas.length, mensajesFallidos: eventos.length, enviosFallidos: envios.length, ultimoEntrante: ultimo.data?.received_at ?? null };
}

/** Texto del comando «resumen» (se excluyen las conversaciones del número administrador). */
export async function resumenParaDueno(db: any, tenantId: string, ahora: number): Promise<string> {
  const dia = ahoraChile(ahora).fecha;
  const [ajustes, admin, mensajes, abiertas, salud] = await Promise.all([
    db.from("agent_whatsapp_settings").select("registrar_chats").eq("tenant_id", tenantId).maybeSingle(),
    db.from("agent_admin_contacts").select("telefono").eq("tenant_id", tenantId),
    fetchAllRows<MensajeResumen & { telefono: string | null }>(() => db.from("agent_chats").select("contact_hash,telefono,direccion,tipo,texto,created_at").eq("tenant_id", tenantId).gte("created_at", new Date(ahora - 72 * 3600000).toISOString())),
    consultasAbiertas(db, tenantId, ahora),
    saludDelDia(db, tenantId, ahora),
  ]);
  const duenos = new Set(((admin.data ?? []) as any[]).map((x) => String(x.telefono)));
  const hashesDueno = new Set(mensajes.filter((m) => m.telefono && duenos.has(m.telefono)).map((m) => m.contact_hash));
  return textoResumen(resumirDia(mensajes.filter((m) => !hashesDueno.has(m.contact_hash)), abiertas, ahora, dia), salud, ajustes.data?.registrar_chats === true);
}
