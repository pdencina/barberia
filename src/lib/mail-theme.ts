import { type AppTheme, normalizeTheme, isDarkTheme } from "@/lib/themes";

// Colores de los correos y de la vista previa por tema. Claro = los de siempre.
export interface MailPalette {
  accent: string; onAccent: string; page: string; card: string; border: string; line: string;
  text: string; text2: string; muted: string; soft: string; soft2: string;
}
export const MAIL_PALETTES: Record<AppTheme, MailPalette> = {
  light: { accent: "#0F8B8D", onAccent: "#FFFFFF", page: "#F4F6F8", card: "#FFFFFF", border: "#E5E7EB", line: "#EEF0F2", text: "#111827", text2: "#374151", muted: "#6B7280", soft: "#F9FAFB", soft2: "#F3F4F6" },
  dark: { accent: "#36C5C8", onAccent: "#0B1216", page: "#0F1218", card: "#151921", border: "#2A303B", line: "#262C36", text: "#F3F4F6", text2: "#D1D5DB", muted: "#9CA3AF", soft: "#1B2029", soft2: "#222833" },
  rose: { accent: "#B73570", onAccent: "#FFFFFF", page: "#FFF0F6", card: "#FFFFFF", border: "#F0CADC", line: "#F7DDE9", text: "#8C2B5C", text2: "#8C2B5C", muted: "#8D5A74", soft: "#FFF5F9", soft2: "#FBE3EE" },
  monochrome: { accent: "#202020", onAccent: "#FFFFFF", page: "#F3F3F3", card: "#FFFFFF", border: "#E0E0E0", line: "#EEEEEE", text: "#202020", text2: "#333333", muted: "#6B6B6B", soft: "#F7F7F7", soft2: "#EFEFEF" },
  "monochrome-dark": { accent: "#FFFFFF", onAccent: "#111111", page: "#0A0A0A", card: "#111111", border: "#2A2A2A", line: "#222222", text: "#FFFFFF", text2: "#E5E5E5", muted: "#A3A3A3", soft: "#181818", soft2: "#202020" },
};

// Recolorea un correo ya armado con los colores base. Si no hay tema (o es el claro) devuelve el correo igual.
export function applyMailTheme(html: string, theme?: AppTheme | string | null): string {
  if (!theme) return html;
  const t = normalizeTheme(theme);
  if (t === "light") return html;
  const p = MAIL_PALETTES[t];
  // Dos pasadas con marcas intermedias: si no, un color nuevo (ej. el acento blanco) se volvería a reemplazar.
  const map: [RegExp, keyof MailPalette][] = [
    [/color:#FFFFFF/g, "onAccent"], [/#0F8B8D/gi, "accent"], [/#F4F6F8/gi, "page"], [/#FFFFFF/gi, "card"], [/#E5E7EB/gi, "border"],
    [/#EEF0F2/gi, "line"], [/#111827/gi, "text"], [/#374151/gi, "text2"], [/#6B7280/gi, "muted"], [/#F9FAFB/gi, "soft"], [/#F3F4F6/gi, "soft2"],
  ];
  let h = html;
  for (const [re, key] of map) h = h.replace(re, key === "onAccent" ? "color:@@onAccent@@" : `@@${key}@@`);
  h = h.replace(/@@(\w+)@@/g, (_, k: string) => p[k as keyof MailPalette]);
  // Logo del sistema según el tema: rosado en Rosa, blanco (sin caja) en los dos oscuros.
  const logo = "https://www.re-booking.cl/logo-horizontal.png";
  if (t === "rose") h = h.replace(logo, "https://www.re-booking.cl/logo-horizontal-rose.png");
  else if (isDarkTheme(t)) h = h.replace(logo, "https://www.re-booking.cl/logo-horizontal-white.png");
  return h;
}
