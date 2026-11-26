// "07:00 (AM)" / "19:30 (PM)": en todo mensaje al cliente la hora va marcada, para que nadie confunda la mañana con la tarde.
export function horaAmPm(hhmm: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? "").trim());
  if (!m || Number(m[1]) > 23) return String(hhmm ?? "");
  return `${m[1].padStart(2, "0")}:${m[2]} (${Number(m[1]) < 12 ? "AM" : "PM"})`;
}
