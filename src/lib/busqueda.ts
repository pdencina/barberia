// Búsquedas que no dependen de tildes ni de mayúsculas: «nestor» encuentra «Néstor», y «Néstor» encuentra «Nestor».

/** Minúsculas y sin tildes/diéresis; la ñ se conserva como ñ. */
export function sinTildes(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "ñ");
}

/** ¿El texto contiene lo buscado, sin importar tildes ni mayúsculas? */
export function contieneSinTildes(texto: unknown, buscado: string): boolean {
  return sinTildes(String(texto ?? "")).includes(sinTildes(buscado));
}

/**
 * Patrón para `ilike` de PostgREST que ignora tildes sin extensiones de la base: cada vocal (y la ñ/n) se vuelve el comodín
 * `_` (un carácter cualquiera), así «nestor» calza con «Néstor» y «NÉSTOR». Los espacios pasan a `%` (palabras en el mismo
 * orden, con cualquier cosa entre medio). Se quitan los caracteres que rompen el filtro `.or(...)`.
 */
export function patronIlikeSinTildes(buscado: string): string {
  const limpio = sinTildes(buscado)
    .replace(/[%_\\,()*"']/g, " ")
    .trim()
    .slice(0, 60);
  if (!limpio) return "";
  return "%" + limpio.split(/\s+/).map((p) => p.replace(/[aeiouñn]/g, "_")).join("%") + "%";
}
