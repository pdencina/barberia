// Codigos del descuento por planilla. Sin letras/numeros que se confunden (0/O, 1/I).
//   - corto: 4 caracteres, para escribirlo a mano.
//   - largo ("PL-" + 10): para la pistola de codigo de barras; el Punto de Venta lo reconoce solo.
export const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const gen = (n: number) => { const a = new Uint32Array(n); crypto.getRandomValues(a); return Array.from(a, (x) => ALPHABET[x % ALPHABET.length]).join(""); };
export const makeShortCode = () => gen(4);
export const makeScanCode = () => `PL-${gen(10)}`;

export type CodigoPlanilla = { tipo: "corto"; code: string } | { tipo: "escaneo"; code: string } | null;
// Lee lo que escribio o escaneo la persona. Los codigos antiguos de 6 caracteres siguen valiendo.
export function leerCodigoPlanilla(input: string): CodigoPlanilla {
  const t = String(input || "").trim().toUpperCase().replace(/\s+/g, "");
  const m = /^PL-?([A-Z0-9]{10})$/.exec(t);
  if (m) return { tipo: "escaneo", code: `PL-${m[1]}` };
  if (/^[A-Z0-9]{4}$/.test(t) || /^[A-Z0-9]{6}$/.test(t)) return { tipo: "corto", code: t };
  return null;
}
export const pareceCodigoPlanilla = (input: string) => /^PL-?[A-Za-z0-9]{10}$/i.test(String(input || "").trim());

export interface LineaPlanilla { product_id: string; product_name: string; quantity: number; unit_price: number; total: number }
export function resumenLineas(lines: Array<{ product_name?: string; name?: string; quantity: number }>): string {
  return lines.map((l) => `${l.product_name || l.name} x${l.quantity}`).join(", ");
}
