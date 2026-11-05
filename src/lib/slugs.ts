// Links limpios de reservas: re-booking.cl/<negocio> y re-booking.cl/<negocio>/<profesional>. Puro: se prueba sin base de datos.
export const LARGO_MIN = 3, LARGO_MAX = 40;

// Nombres que ya son direcciones de re-booking (o lo serán): un negocio no puede llamarse así porque la dirección ya tiene otro uso.
export const RESERVADOS = new Set([
  "api", "auth", "b", "booking", "cambiar-clave", "cancel", "dashboard", "eliminar-cuenta", "galeria", "landing", "login", "portal", "privacidad", "pro",
  "ranking", "registro", "reset-password", "review", "signup", "suscribirse", "suscripcion", "terminos",
  "admin", "app", "www", "soporte", "ayuda", "precios", "contacto", "blog", "empresa", "empresas", "socios", "static", "public", "assets", "images", "img", "icons",
  "favicon", "robots", "sitemap", "manifest", "sw", "next", "_next", "re-booking", "rebooking", "oti", "mi-negocio", "demo", "test", "null", "undefined",
]);

// «Looky Estudio!» -> «looky-estudio» (sin tildes ni símbolos).
export function normalizarSlug(entrada: string): string {
  return String(entrada ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, LARGO_MAX).replace(/-+$/g, "");
}

// null = es un nombre válido; si no, el motivo en palabras.
export function validarSlug(slug: string, opciones: { reservados?: boolean } = {}): string | null {
  const s = String(slug ?? "");
  if (s.length < LARGO_MIN) return `Muy corto: usa al menos ${LARGO_MIN} caracteres.`;
  if (s.length > LARGO_MAX) return `Muy largo: máximo ${LARGO_MAX} caracteres.`;
  if (!/^[a-z0-9-]+$/.test(s)) return "Solo letras minúsculas, números y guiones.";
  if (/^-|-$/.test(s)) return "No puede empezar ni terminar con guion.";
  if (/--/.test(s)) return "No uses dos guiones seguidos.";
  if (opciones.reservados !== false && RESERVADOS.has(s)) return "Ese nombre está reservado por re-booking. Elige otro.";
  return null;
}

// Alternativas cuando el nombre elegido está ocupado.
export function alternativas(slug: string): string[] {
  const base = normalizarSlug(slug).slice(0, LARGO_MAX - 3).replace(/-+$/g, "");
  return [`${base}-cl`, `${base}-2`, `${base}-oficial`].filter((s) => !validarSlug(s)).slice(0, 3);
}

// Direcciones (siempre con www y sin parámetros).
export const ORIGEN_PUBLICO = "https://www.re-booking.cl";
export const linkNegocio = (slug: string, origen = ORIGEN_PUBLICO) => `${origen.replace(/\/$/, "")}/${slug}`;
export const linkProfesional = (slugNegocio: string, slugProfesional: string, origen = ORIGEN_PUBLICO) => `${linkNegocio(slugNegocio, origen)}/${slugProfesional}`;
