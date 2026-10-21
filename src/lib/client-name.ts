// Nombres de cliente con el texto "null" / "undefined" (vienen de importaciones antiguas, ej. "Matias null"): se quitan al
// escribirlos en avisos y fichas nuevas, para que no sigan apareciendo aunque el dato guardado aun no se haya limpiado.
export function cleanClientName(v: unknown): string {
  return String(v ?? "").replace(/(^|\s)(null|undefined)(?=\s|$)/gi, " ").replace(/\s+/g, " ").trim();
}
