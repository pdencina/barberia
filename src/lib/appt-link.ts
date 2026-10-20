// Avisos de citas: el link abre el calendario en el dia de la cita y muestra el cuadro de esa cita
// (lo recibe `ApptDeepLink` en dashboard/calendario). `date` es "YYYY-MM-DD".
export function apptNoticeUrl(appointmentId: string, date: string): string {
  return `/dashboard/calendario?appt=${encodeURIComponent(appointmentId)}&date=${encodeURIComponent(date)}`;
}

// "mar, 20 oct" a partir de "YYYY-MM-DD" (sin depender de la zona horaria del servidor).
export function apptDayLabel(date: string): string {
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00Z`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(/\./g, "");
}

// Avisos de citas guardados antes de existir el link con la cita apuntan a Agenda / Mi agenda:
// se llevan al Calendario (sin cita puntual, porque esos avisos no guardaron cual era).
export function noticeHref(kind: string, url: string | null): string | null {
  if (!url) return url;
  if (kind.startsWith("appointment_") && (url === "/dashboard/agenda" || url === "/dashboard/mi-agenda")) return "/dashboard/calendario";
  return url;
}
