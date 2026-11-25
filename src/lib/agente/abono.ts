// Servicios que se reservan CON ABONO (rizos, visos, ondulación, color): el agente no los agenda solo.
// La regla la define el negocio en sus respuestas: una respuesta que habla de abono y tiene claves como "reservar visos" / "abono rizos".
// Sin esa respuesta, todo se agenda como siempre.
import type { DatosFaq } from "./faq-fija";
import { palabras } from "./servicio-profesional";

// "palabras" iguala sonidos (reservar → reserbar), así que las listas se pasan por la misma función.
const RELLENO = new Set(palabras("reservar agendar abono trabajo quimico quimicos para del una uno"));
const DISPARO = new Set(palabras("reservar agendar abono"));
const calza = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** Texto de abono del negocio para ese servicio, o null si se agenda sin abono. */
export function textoDeAbono(servicio: string, datos: DatosFaq | null): string | null {
  const propias = datos?.personalizadas;
  if (!Array.isArray(propias)) return null;
  const nombre = palabras(servicio).filter((w) => w.length >= 4 && !RELLENO.has(w));
  for (const p of propias) {
    if (!p || typeof p.respuesta !== "string" || !/abon/i.test(p.respuesta) || !Array.isArray(p.claves)) continue;
    const toca = p.claves.some((c) => {
      const ws = palabras(String(c));
      if (!ws.some((w) => DISPARO.has(w))) return false;
      return ws.filter((w) => w.length >= 4 && !RELLENO.has(w)).some((w) => nombre.some((n) => calza(w, n)));
    });
    if (toca) return p.respuesta.trim();
  }
  return null;
}
