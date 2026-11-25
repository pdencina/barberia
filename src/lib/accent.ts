// Color principal que cada negocio elige para su página de reservas. Se guarda como #RRGGBB y se convierte a las variables HSL del sistema.
export const ACENTOS = [
  { hex: "#C62828", label: "Rojo" },
  { hex: "#B8860B", label: "Dorado" },
  { hex: "#D6336C", label: "Rosado" },
  { hex: "#EA580C", label: "Naranja" },
  { hex: "#7C3AED", label: "Morado" },
  { hex: "#2563EB", label: "Azul" },
  { hex: "#15803D", label: "Verde" },
  { hex: "#1F2937", label: "Negro" },
] as const;

export const esHexAcento = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

export function hexAHsl(hex: string): { h: number; s: number; l: number } | null {
  if (!esHexAcento(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = Math.round(h * 60); if (h < 0) h += 360;
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Variables CSS (triplete HSL, como usa Tailwind) para aplicar el color. En fondos oscuros se aclara para que se lea; en claros se oscurece un poco para que el texto blanco del botón se lea.
export function variablesDeAcento(hex: string, oscuro: boolean): Record<string, string> | null {
  const c = hexAHsl(hex);
  if (!c) return null;
  const principal = oscuro ? Math.min(66, Math.max(52, c.l)) : Math.min(46, Math.max(26, c.l));
  const claro = Math.min(90, principal + 10);
  const tono = (l: number) => `${c.h} ${c.s}% ${l}%`;
  return { "--brand-blue": tono(principal), "--brand-accent": tono(claro), "--primary": tono(principal), "--ring": tono(principal) };
}
