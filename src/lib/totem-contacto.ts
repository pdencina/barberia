// Enlaces de contacto que el tótem muestra como QR: WhatsApp del negocio y su página web.

// Acepta un número (+56 9 4266 6172, 942666172) o un enlace de WhatsApp (wa.me/...) y devuelve https://wa.me/<solo dígitos>. Sin número válido: null.
export function enlaceWhatsapp(valor: unknown): string | null {
  const s = String(valor || "").trim();
  if (!s) return null;
  const m = s.match(/wa\.me\/(\d{8,15})/i);
  let d = m ? m[1] : s.replace(/\D/g, "");
  if (d.length === 9 && d.startsWith("9")) d = `56${d}`; // celular chileno escrito sin el +56
  return d.length >= 10 && d.length <= 15 ? `https://wa.me/${d}` : null;
}

// Dirección web: se agrega https:// si falta; solo se aceptan http/https. Sin dirección válida: null.
export function enlaceWeb(valor: unknown): string | null {
  const s = String(valor || "").trim();
  if (!s || /\s/.test(s)) return null;
  const url = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") ? u.toString().replace(/\/$/, "") : null;
  } catch { return null; }
}
