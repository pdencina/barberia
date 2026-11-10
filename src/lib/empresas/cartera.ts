// Cartera por vendedor: cuándo toca llamar a cada cliente, la cola obligatoria y el reporte semanal (Etapa 2).
// Funciones puras: reciben los datos ya leídos y la hora actual, así se prueban sin base de datos.

export type ActivityResult = "sold" | "no_answer" | "callback" | "not_interested" | "skipped";

export const RESULT_LABEL: Record<ActivityResult, string> = {
  sold: "Vendió",
  no_answer: "No contestó",
  callback: "Volver a llamar",
  not_interested: "Sin interés",
  skipped: "Saltado",
};

export type CarteraSettings = { contactEveryDays: number; noAnswerRetryDays: number; maxNoAnswerAttempts: number };

export type Activity = { customerId: string; sellerId: string; result: ActivityResult; createdAt: string; callbackOn?: string | null };

const DAY = 24 * 60 * 60 * 1000;

// Fecha "YYYY-MM-DD" de volver a llamar: se toma desde el inicio de ese día en Chile (UTC-3/-4). Se usa UTC-4 para no adelantarla.
const callbackTime = (d: string) => Date.parse(`${d}T04:00:00Z`);

/**
 * Cuándo vuelve a tocar un cliente, según su última gestión.
 * - Nunca gestionado: ya (se ordena por antigüedad del cliente).
 * - Vendió / sin interés: un ciclo después (contactEveryDays).
 * - Volver a llamar: en la fecha acordada.
 * - Saltado: al día siguiente (saltarse exige motivo y aparece en el reporte).
 * - No contestó: reintenta cada noAnswerRetryDays hasta maxNoAnswerAttempts seguidos; después, un ciclo desde el primer intento.
 * Un pedido del cliente cuenta como "vendió".
 */
export function nextDueAt(activities: Activity[], settings: CarteraSettings, createdAt: string): number {
  if (activities.length === 0) return Date.parse(createdAt) || 0;
  const sorted = [...activities].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const last = sorted[0];
  const lastAt = Date.parse(last.createdAt);
  switch (last.result) {
    case "sold":
    case "not_interested":
      return lastAt + settings.contactEveryDays * DAY;
    case "callback":
      return last.callbackOn ? callbackTime(last.callbackOn) : lastAt + DAY;
    case "skipped":
      return lastAt + DAY;
    case "no_answer": {
      let streak = 0;
      let firstOfStreak = lastAt;
      for (const a of sorted) {
        if (a.result !== "no_answer") break;
        streak++;
        firstOfStreak = Date.parse(a.createdAt);
      }
      if (streak >= settings.maxNoAnswerAttempts) return firstOfStreak + settings.contactEveryDays * DAY;
      return lastAt + settings.noAnswerRetryDays * DAY;
    }
  }
}

export type QueueCustomer = { id: string; name: string; createdAt: string; assignedSellerId: string | null };
export type QueueItem = { customerId: string; name: string; dueAt: number; lastResult: ActivityResult | null; lastAt: string | null };

/** Clientes que ya tocan (dueAt <= now), del más atrasado al más reciente. El primero es el que el vendedor debe resolver. */
export function buildQueue(customers: QueueCustomer[], activities: Activity[], settings: CarteraSettings, now: number): QueueItem[] {
  const byCustomer = new Map<string, Activity[]>();
  for (const a of activities) {
    const list = byCustomer.get(a.customerId);
    if (list) list.push(a);
    else byCustomer.set(a.customerId, [a]);
  }
  const items: QueueItem[] = [];
  for (const c of customers) {
    const acts = byCustomer.get(c.id) || [];
    const dueAt = nextDueAt(acts, settings, c.createdAt);
    if (dueAt > now) continue;
    const last = acts.reduce<Activity | null>((m, a) => (!m || Date.parse(a.createdAt) > Date.parse(m.createdAt) ? a : m), null);
    items.push({ customerId: c.id, name: c.name, dueAt, lastResult: last?.result ?? null, lastAt: last?.createdAt ?? null });
  }
  return items.sort((a, b) => a.dueAt - b.dueAt || a.name.localeCompare(b.name));
}

// Lunes 00:00 de Chile de la semana que contiene `now`, como "YYYY-MM-DD". Se usa UTC-3 (horario de verano de Chile).
export function weekStartChile(now: number): string {
  const local = new Date(now - 3 * 60 * 60 * 1000);
  const dow = (local.getUTCDay() + 6) % 7; // 0 = lunes
  local.setUTCDate(local.getUTCDate() - dow);
  return local.toISOString().slice(0, 10);
}

/** Rango [desde, hasta) en milisegundos de una semana que parte el lunes `weekStart` (hora de Chile). */
export function weekRange(weekStart: string): { from: number; to: number } {
  const from = Date.parse(`${weekStart}T03:00:00Z`);
  return { from, to: from + 7 * DAY };
}

export type SellerReport = {
  sellerId: string;
  portfolio: number;     // clientes en su cartera
  managed: number;       // clientes distintos con alguna gestión (o pedido) en la semana
  sold: number;          // clientes distintos a los que les vendió
  unattended: number;    // cartera sin ninguna gestión en la semana
  skipped: number;       // veces que se saltó un cliente
  activities: number;    // gestiones anotadas
};

/** Reporte semanal por vendedor: de su cartera, cuántos gestionó, a cuántos les vendió y cuántos quedaron sin atender. */
export function weeklyReport(
  sellerIds: string[],
  customers: QueueCustomer[],
  activities: Activity[],
  range: { from: number; to: number },
): SellerReport[] {
  const inWeek = activities.filter((a) => {
    const t = Date.parse(a.createdAt);
    return t >= range.from && t < range.to;
  });
  return sellerIds.map((sellerId) => {
    const mine = new Set(customers.filter((c) => c.assignedSellerId === sellerId).map((c) => c.id));
    const acts = inWeek.filter((a) => a.sellerId === sellerId || mine.has(a.customerId));
    const managedIds = new Set(acts.filter((a) => a.result !== "skipped").map((a) => a.customerId));
    const soldIds = new Set(acts.filter((a) => a.result === "sold").map((a) => a.customerId));
    let unattended = 0;
    mine.forEach((id) => { if (!managedIds.has(id)) unattended++; });
    return {
      sellerId,
      portfolio: mine.size,
      managed: Array.from(managedIds).filter((id) => mine.has(id)).length,
      sold: Array.from(soldIds).filter((id) => mine.has(id)).length,
      unattended,
      skipped: acts.filter((a) => a.result === "skipped" && a.sellerId === sellerId).length,
      activities: acts.filter((a) => a.sellerId === sellerId).length,
    };
  });
}
