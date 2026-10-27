// Texto sin tildes ni signos, en minusculas y con espacios simples: para comparar lo que escribe la persona con el catalogo.
export function norm(s: string): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
