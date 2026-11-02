// Mes (primer dia, hora de Chile) en que se PIDIO un descuento por planilla. El descuento cuenta en ese mes aunque se apruebe despues:
// si hoy (2 nov.) se pide algo, se paga a fin de este mes; lo pedido el 31 oct. y aprobado el 2 nov. cuenta en octubre.
export function planillaMonthStart(requestedAtIso: string | null | undefined, fallbackToday: string): string {
  const d = requestedAtIso ? new Date(requestedAtIso) : null;
  if (!d || Number.isNaN(d.getTime())) return `${fallbackToday.slice(0, 7)}-01`;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value, m = parts.find((p) => p.type === "month")?.value;
  return y && m ? `${y}-${m}-01` : `${fallbackToday.slice(0, 7)}-01`;
}
