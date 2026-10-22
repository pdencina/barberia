// Cache de lectura del lado del navegador ("mostrar lo ultimo guardado y actualizar por detras").
// - Solo sessionStorage: se borra al cerrar la pestana y no pasa a otros usuarios del mismo equipo.
// - La clave incluye usuario y negocio (ver cacheKey) y se vacia completa al cerrar sesion (clearAppCache).
// - Maxima antiguedad: pasado ese tiempo se ignora y la pantalla carga como antes.
// - Nunca debe usarse para cobrar, cerrar caja ni editar: solo para pantallas de lectura.

const PREFIX = "rb-cache:";
const MAX_ENTRIES = 30;
export const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;

export function cacheKey(parts: Array<string | null | undefined>): string | null {
  // Sin usuario o sin negocio no hay clave segura: no se usa cache.
  if (parts.length === 0 || parts.some((p) => !p)) return null;
  return PREFIX + parts.join("|");
}

export function readCache<T>(key: string | null, maxAgeMs: number = DEFAULT_MAX_AGE_MS): T | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (typeof at !== "number" || Date.now() - at > maxAgeMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

export function writeCache(key: string | null, data: unknown): void {
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
    // Tope de entradas: se borran las mas antiguas.
    const keys: Array<{ k: string; at: number }> = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      let at = 0;
      try { at = JSON.parse(sessionStorage.getItem(k) || "{}").at || 0; } catch { /* entrada danada: se borra primero */ }
      keys.push({ k, at });
    }
    if (keys.length > MAX_ENTRIES) {
      keys.sort((a, b) => a.at - b.at).slice(0, keys.length - MAX_ENTRIES).forEach(({ k }) => sessionStorage.removeItem(k));
    }
  } catch {
    // Sin espacio o sin almacenamiento: se sigue sin cache.
  }
}

export function clearAppCache(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignorar
  }
}
