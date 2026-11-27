// Colores propios del correo de promoción. La regla: nunca puede quedar texto, botón o logo que no se lea. Puro.
export interface ColoresCorreo { fondo: string; texto: string; boton: string }

export const PALETAS: Array<{ nombre: string; colores: ColoresCorreo }> = [
  { nombre: "Crema y vino", colores: { fondo: "#F6EDE8", texto: "#3B1F28", boton: "#8E3B55" } },
  { nombre: "Rosa", colores: { fondo: "#FBE4EC", texto: "#4A1030", boton: "#B8245A" } },
  { nombre: "Blanco y negro", colores: { fondo: "#FFFFFF", texto: "#111111", boton: "#111111" } },
  { nombre: "Verde", colores: { fondo: "#EAF4EE", texto: "#14321F", boton: "#1F7A4D" } },
  { nombre: "Azul noche", colores: { fondo: "#0F1B2D", texto: "#FFFFFF", boton: "#F2C14E" } },
];

const HEX = /^#[0-9a-f]{6}$/i;
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const luz = (r: number, g: number, b: number) => {
  const c = [r, g, b].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const razon = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
export const contraste = (a: string, b: string) => razon(luz(...(rgb(a) as [number, number, number])), luz(...(rgb(b) as [number, number, number])));
/** Blanco o casi negro: el que se lea mejor encima de ese color. */
export const sobre = (fondo: string) => (contraste(fondo, "#FFFFFF") >= contraste(fondo, "#111111") ? "#FFFFFF" : "#111111");
/** `cuanto` del color `a` sobre `b` (0 a 1). */
export const mezcla = (a: string, b: string, cuanto: number) => {
  const x = rgb(a), y = rgb(b);
  return `#${x.map((v, i) => Math.round(v * cuanto + y[i] * (1 - cuanto)).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
};

/** Deja colores válidos y legibles: si el texto o el botón no contrastan con el fondo, se corrigen. */
export function coloresLegibles(c: any): ColoresCorreo | null {
  if (!c || ![c.fondo, c.texto, c.boton].every((v) => typeof v === "string" && HEX.test(v))) return null;
  const texto = contraste(c.texto, c.fondo) >= 4.5 ? c.texto : sobre(c.fondo);
  const boton = contraste(c.boton, c.fondo) >= 2 ? c.boton : texto;
  return { fondo: c.fondo, texto, boton };
}

/**
 * ¿El logo se pierde sobre ese fondo? `pixeles` = RGBA de la imagen. Devuelve el color del recuadro que conviene ponerle detrás, o null.
 * Un logo casi sin transparencia trae su propio fondo y no necesita nada.
 */
export function fondoParaLogo(pixeles: ArrayLike<number>, fondo: string): string | null {
  const total = pixeles.length / 4;
  const luces: number[] = [];
  for (let i = 0; i < pixeles.length; i += 4) if (pixeles[i + 3] > 128) luces.push(luz(pixeles[i], pixeles[i + 1], pixeles[i + 2]));
  if (!luces.length || luces.length / total > 0.85) return null;
  const seVe = (color: string) => { const f = luz(...(rgb(color) as [number, number, number])); return luces.filter((l) => razon(l, f) >= 2.5).length / luces.length; };
  if (seVe(fondo) >= 0.5) return null;
  return seVe("#FFFFFF") >= seVe("#111111") ? "#FFFFFF" : "#111111";
}
