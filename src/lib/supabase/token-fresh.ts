// Decide, SIN llamar a Supabase, si la sesion de la cookie sigue vigente con margen.
// Solo sirve para saltarse el viaje de red del middleware al navegar DENTRO del panel (/dashboard): si al token le queda
// poco, esta vencido o la cookie no se entiende, devuelve false y el middleware hace la validacion completa de siempre
// (que ademas refresca la cookie).
//
// OJO, esto NO verifica la firma del token: solo lee su fecha de vencimiento. Es seguro porque en /dashboard el middleware
// protege unicamente la carcasa de la pagina; los datos salen de las rutas /api, que validan la sesion con Supabase por
// su cuenta, y el layout la vuelve a validar en cada carga completa. No usar esta funcion para proteger datos.

// Margen: con menos de 5 min de vida se usa la validacion completa, que refresca la cookie antes de que venza.
export const FRESH_MARGIN_SECONDS = 300;

type CookieReader = { getAll(): { name: string; value: string }[] };

function authCookieValue(cookies: CookieReader): string | null {
  const all = cookies.getAll().filter((c) => /^sb-[a-z0-9]+-auth-token(\.\d+)?$/i.test(c.name));
  if (all.length === 0) return null;
  // La cookie se parte en trozos (.0, .1, ...) cuando es muy grande: se juntan en orden.
  const parts = all.sort((a, b) => {
    const ai = Number(a.name.split(".")[1] ?? -1);
    const bi = Number(b.name.split(".")[1] ?? -1);
    return ai - bi;
  });
  return parts.map((c) => c.value).join("");
}

function decodeBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  // atob entrega bytes; se reinterpretan como UTF-8 por si el token trae caracteres no ASCII.
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function hasFreshSessionToken(cookies: CookieReader, nowMs: number = Date.now()): boolean {
  try {
    const raw = authCookieValue(cookies);
    if (!raw) return false;
    let text = raw;
    try {
      text = decodeURIComponent(raw);
    } catch {
      // ya venia decodificada
    }
    if (text.startsWith("base64-")) text = decodeBase64Url(text.slice(7));
    const session = JSON.parse(text);
    const token: unknown = session?.access_token;
    if (typeof token !== "string") return false;
    // Sin refresh_token no hay como renovar la sesion: se deja a la validacion completa.
    if (typeof session?.refresh_token !== "string" || session.refresh_token === "") return false;
    const segs = token.split(".");
    if (segs.length !== 3) return false;
    const payload = JSON.parse(decodeBase64Url(segs[1]));
    if (typeof payload.exp !== "number" || typeof payload.sub !== "string" || payload.sub === "") return false;
    return payload.exp - nowMs / 1000 > FRESH_MARGIN_SECONDS;
  } catch {
    return false;
  }
}
