// Reloj real de Chile; horas de citas leídas como hora de pared, sin otra conversión.
export function chileClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)?.value || "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, time: `${value("hour")}:${value("minute")}` };
}
export function currentAppointmentId(rows: Array<{id: string; end_time: string; status: string}>, date: string, clock: { date: string; time: string }) {
  if (date !== clock.date) return null;
  return rows.find(r => ["scheduled", "confirmed", "in_progress"].includes(r.status) && (r.end_time.match(/(\d{2}:\d{2})/)?.[1] || "") > clock.time)?.id || null;
}
