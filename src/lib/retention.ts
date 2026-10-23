import type { createAdminSupabase } from "@/lib/supabase/server";
import { todayInChile, toChileDateStr, daysBetweenDateStrs } from "@/lib/utils";
import { fetchAllRows } from "@/lib/accounting";

// Fuente UNICA de "quien esta inactivo" — la usan la pantalla de Retencion y el envio
// masivo, para que el numero que ves en pantalla sea exactamente el que recibe el mensaje
// (antes la pantalla usaba ">= N dias" y el envio "> N dias", y no coincidian).
//
// Reglas:
//  - Solo visitas COMPLETADAS y posteriores a tenants.retention_start_date (o a la creacion
//    del negocio): las anteriores son importacion/pruebas y no son confiables (Punto 13).
//  - Si nunca hubo una visita valida, el reloj parte en la fecha de registro del cliente
//    (sin ir antes del inicio real del negocio).
//  - Un cliente con una cita por venir (agendada/confirmada/en curso) NO es inactivo.
//  - Inactivo = dias desde su ultima visita (o registro) >= N.

export interface RetentionClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  lastVisit: string | null;
  totalVisits: number;
  daysSinceVisit: number;
  hasUpcoming: boolean;
}

/**
 * Visitas REALES de los clientes de un negocio, leidas por paginas (sin el tope de 1.000 filas) y filtradas por negocio.
 * Compartida por Retencion, el envio masivo y la pantalla de WhatsApp, para que las tres muestren lo mismo.
 */
export async function loadVisitInfo(supabase: ReturnType<typeof createAdminSupabase>, tenantId: string): Promise<{
  retentionStartDate: string | null;
  lastVisitMap: Record<string, string>;
  visitCountMap: Record<string, number>;
  upcoming: Set<string>;
}> {
  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("retention_start_date, created_at")
    .eq("id", tenantId)
    .single();
  const retentionStartDate: string | null = tenantRow?.retention_start_date || tenantRow?.created_at || null;

  // Una VISITA es un dia en que el cliente tuvo una cita completada o una venta cobrada (despues del inicio real del negocio).
  // Se usan las dos porque no todo el que viene tiene cita: un cobro directo en el Punto de Venta tambien es una visita.
  // Se cuenta un dia una sola vez (una cita cobrada en caja genera cita completada y venta).
  const visitDays = new Set<string>();
  const lastVisitMap: Record<string, string> = {};
  const visitCountMap: Record<string, number> = {};
  const addVisit = (clientId: string | null, day: string | null) => {
    if (!clientId || !day) return;
    const key = `${clientId}|${day}`;
    if (visitDays.has(key)) return;
    visitDays.add(key);
    visitCountMap[clientId] = (visitCountMap[clientId] || 0) + 1;
    if (!lastVisitMap[clientId] || day > lastVisitMap[clientId]) lastVisitMap[clientId] = day;
  };

  const appointments = await fetchAllRows(() => {
    let q = supabase.from("appointments").select("id, client_id, date").eq("tenant_id", tenantId).eq("status", "completed").not("client_id", "is", null);
    if (retentionStartDate) q = q.gte("date", retentionStartDate);
    return q;
  });
  for (const a of appointments) addVisit(a.client_id, a.date);

  const sales = await fetchAllRows(() => {
    let q = supabase.from("transactions").select("id, client_id, created_at").eq("tenant_id", tenantId).eq("type", "income").eq("status", "completed").not("client_id", "is", null);
    if (retentionStartDate) q = q.gte("created_at", retentionStartDate);
    return q;
  });
  for (const t of sales) addVisit(t.client_id, toChileDateStr(t.created_at));

  const future = await fetchAllRows(() =>
    supabase.from("appointments").select("id, client_id").eq("tenant_id", tenantId).in("status", ["scheduled", "confirmed", "in_progress"]).gte("date", todayInChile()).not("client_id", "is", null)
  );
  const upcoming = new Set((future || []).map((f: any) => f.client_id));
  return { retentionStartDate, lastVisitMap, visitCountMap, upcoming };
}

export async function getInactiveClients(
  supabase: ReturnType<typeof createAdminSupabase>,
  tenantId: string,
  days: number,
  // includeNever: true (por defecto, como siempre) cuenta tambien a quien NUNCA tuvo una visita registrada (clientes nuevos o
  // importados): su reloj parte en la fecha de registro y no significa que "dejaron de venir". La pantalla de Retencion y el
  // envio masivo piden false para hablarle solo a quien SI vino alguna vez, y avisan cuantos quedan fuera.
  opts: { includeNever?: boolean; maxDays?: number | null } = {}
): Promise<{ total: number; inactive: RetentionClient[]; neverVisited: number }> {
  const includeNever = opts.includeNever !== false;
  // Ley 21.719: no se escribe a quien pidio no ser contactado ni a quien rechazo las promociones (migracion 101).
  // Si la migracion aun no esta, se trabaja como antes (sin esa marca).
  // Supabase entrega como maximo 1.000 filas por consulta: se lee por paginas para no perder clientes ni visitas
  // (antes un negocio con mas de 1.000 clientes quedaba con una parte al azar y sus visitas "desaparecian").
  let optedOut = new Set<string>();
  let clients: any[];
  try {
    clients = await fetchAllRows(() => supabase.from("clients").select("id, name, email, phone, created_at, marketing_consent, do_not_contact").eq("tenant_id", tenantId));
    optedOut = new Set(clients.filter((c: any) => c.do_not_contact === true || c.marketing_consent === false).map((c: any) => c.id));
  } catch {
    // Falta la migracion 101: se trabaja como antes (sin esa marca).
    clients = await fetchAllRows(() => supabase.from("clients").select("id, name, email, phone, created_at").eq("tenant_id", tenantId));
  }
  if (!clients || clients.length === 0) return { total: 0, inactive: [], neverVisited: 0 };

  const { retentionStartDate, lastVisitMap, visitCountMap, upcoming } = await loadVisitInfo(supabase, tenantId);

  const today = todayInChile();
  const inactive = clients
    .map((client): RetentionClient => {
      let sinceRef = lastVisitMap[client.id] || toChileDateStr(client.created_at);
      if (!lastVisitMap[client.id] && retentionStartDate) {
        const startStr = toChileDateStr(retentionStartDate);
        if (sinceRef < startStr) sinceRef = startStr;
      }
      return {
        ...client,
        lastVisit: lastVisitMap[client.id] || null,
        totalVisits: visitCountMap[client.id] || 0,
        daysSinceVisit: daysBetweenDateStrs(today, sinceRef),
        hasUpcoming: upcoming.has(client.id),
      };
    })
    .filter((c) => !c.hasUpcoming && c.daysSinceVisit >= days && (!opts.maxDays || c.daysSinceVisit <= opts.maxDays) && !optedOut.has(c.id))
    .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit);

  const neverVisited = inactive.filter((c) => !c.lastVisit).length;
  return { total: clients.length, inactive: includeNever ? inactive : inactive.filter((c) => !!c.lastVisit), neverVisited };
}

/**
 * Ids de clientes que el negocio desmarco en la pantalla de Retencion (no recibiran el mensaje masivo).
 * Solo sirve para QUITAR gente de la lista que calcula el servidor: nunca agrega a nadie.
 */
export function parseExcludeIds(v: unknown): Set<string> {
  if (!Array.isArray(v)) return new Set();
  return new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64).slice(0, 20000));
}

/** Quita de la lista a los clientes desmarcados. Se aplica ANTES de deduplicar por correo/telefono. */
export function excludeClients<T extends { id: string }>(list: T[], excluded: Set<string>): T[] {
  return excluded.size > 0 ? list.filter((c) => !excluded.has(c.id)) : list;
}

/** Deja un solo cliente por correo / telefono (dos fichas con el mismo dato no reciben doble mensaje). */
export function dedupeBy<T>(items: T[], key: (i: T) => string | null): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/** Logo del negocio para los correos (null si no subio uno: el correo usa entonces el logo de re-booking). */
export async function tenantLogoUrl(
  supabase: ReturnType<typeof createAdminSupabase>,
  tenantId: string
): Promise<string | null> {
  const { data } = await supabase.from("tenants").select("logo_url").eq("id", tenantId).maybeSingle();
  const url = (data as any)?.logo_url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

/** Link de reserva del negocio (el mismo que usa Mensajes por WhatsApp). */
export async function tenantBookingUrl(
  supabase: ReturnType<typeof createAdminSupabase>,
  tenantId: string
): Promise<string> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://re-booking.cl";
  const { data } = await supabase.from("tenants").select("slug").eq("id", tenantId).single();
  return data?.slug ? `${base}/b/${data.slug}` : `${base}/booking`;
}
