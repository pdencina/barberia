// Proyección sobre precios reservados; no representa pagos ni una liquidación.
export interface AgendaSummaryAppointment {
  id: string;
  client_id?: string | null;
  status: string;
  services: Array<{ price: number | string | null }> | null;
}
export function summarizeAgenda(
  rows: AgendaSummaryAppointment[],
  newIds: Set<string> | null,
  profile: { commission_rate: number | string | null; work_mode: string | null; role?: string | null },
) {
  const active = rows.filter(r => ["scheduled", "confirmed", "in_progress", "completed"].includes(r.status));
  const newClients = new Set(active.filter(r => r.client_id && newIds?.has(r.id)).map(r => r.client_id)).size;
  const rawRate = profile.commission_rate;
  const rate = rawRate === null || rawRate === undefined || rawRate === "" ? NaN : Number(rawRate);
  const commissionRate = Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : null;
  let serviceTotal = 0;
  let pricesComplete = true;
  for (const row of active) {
    if (!row.services?.length) pricesComplete = false;
    for (const service of row.services ?? []) {
      const price = service.price === null || service.price === "" ? NaN : Number(service.price);
      if (!Number.isFinite(price) || price < 0) pricesComplete = false;
      else serviceTotal += price;
    }
  }
  const commissionMode = profile.work_mode === null || profile.work_mode === "commission";
  // Administradores y profesionales en arriendo proyectan el total completo de sus servicios.
  const fullDayTotal = profile.role === "admin" || profile.work_mode === "rental";
  return {
    incomeBasis: fullDayTotal ? "day_total" as const : "commission" as const,
    appointments: active.length,
    completed: active.filter(r => r.status === "completed").length,
    newClients: newIds === null ? null : newClients,
    unlinkedClients: active.filter(r => !r.client_id).length,
    commissionRate,
    expectedIncome: fullDayTotal && pricesComplete ? Math.round(serviceTotal)
      : commissionMode && commissionRate !== null && pricesComplete
        ? Math.round(serviceTotal * commissionRate / 100) : null,
    incomeUnavailable: !fullDayTotal && !commissionMode ? "No aplica porcentaje en esta modalidad" : !fullDayTotal && commissionRate === null
      ? "Falta configurar el porcentaje" : !pricesComplete ? "Faltan precios de servicios" : null,
  };
}
export type AgendaSummary = ReturnType<typeof summarizeAgenda> & { actualSales?: number | null };

// Ventas completadas del profesional; los abonos aplicados forman parte del valor vendido.
export function sumAgendaSales(rows: Array<{ total: number | string | null; prepaid_amount?: number | string | null; notes?: string | null }>): number | null {
  let total = 0;
  for (const row of rows) {
    if (String(row.notes || "").startsWith("[AJUSTE MANUAL]")) continue;
    if (row.total === null || row.total === "") return null;
    const amount = Number(row.total), prepaid = Number(row.prepaid_amount ?? 0);
    if (!Number.isFinite(amount) || !Number.isFinite(prepaid) || amount < 0 || prepaid < 0) return null;
    total += amount + prepaid;
  }
  return Math.round(total);
}
