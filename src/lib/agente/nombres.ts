// Comparación tolerante de nombres de personas escritos por WhatsApp: "dilan" = Dylan, "filipe" = Felipe, "bastián" = Bastian.
// Solo compara palabras sueltas; quien llama decide qué hacer con empates (ver puntajes en reserva-chat y disponibilidad).

/** Pronunciación aproximada en español: y/ll→i, h muda, v→b, z/c suave→s, c/qu/k→k, sin repetidas ni tildes. */
export function fonetica(s: string): string {
  let t = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zñ]/g, "");
  t = t.replace(/ñ/g, "n").replace(/ll/g, "i").replace(/y/g, "i").replace(/h/g, "").replace(/v/g, "b").replace(/w/g, "u").replace(/z/g, "s")
    .replace(/c(?=[ei])/g, "s").replace(/qu/g, "k").replace(/c/g, "k").replace(/(.)\1+/g, "$1");
  return t;
}
function distancia(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** ¿La palabra escrita `w` es la palabra `tok` de un nombre? Igual, inicio (4+ letras), misma pronunciación o una letra de diferencia (5+ letras). */
export function palabraCalza(w: string, tok: string): boolean {
  if (w === tok) return true;
  if (w.length >= 4 && tok.startsWith(w)) return true;
  const a = fonetica(w), b = fonetica(tok);
  if (a.length >= 3 && a === b) return true;
  return a.length >= 5 && b.length >= 5 && distancia(a, b) <= 1;
}
