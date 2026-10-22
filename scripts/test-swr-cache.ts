// Pruebas de src/lib/swr-cache.ts con un sessionStorage falso. Ejecutar: npx tsx scripts/test-swr-cache.ts
class FakeStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const fake = new FakeStorage();
(globalThis as any).sessionStorage = fake;

import { cacheKey, readCache, writeCache, clearAppCache } from "../src/lib/swr-cache";

let fails = 0;
const t = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "OK " : "MAL"} ${name}`); };

t("sin usuario no hay clave", cacheKey(["dashboard", undefined, "neg", "2026-10-22"]) === null);
t("sin negocio no hay clave", cacheKey(["dashboard", "u1", null, "2026-10-22"]) === null);
t("con todo hay clave", typeof cacheKey(["dashboard", "u1", "neg", "2026-10-22", "7d"]) === "string");
t("leer con clave null devuelve null", readCache(null) === null);

const kA = cacheKey(["dashboard", "u1", "negA", "2026-10-22", "7d"]);
const kB = cacheKey(["dashboard", "u2", "negA", "2026-10-22", "7d"]);
const kC = cacheKey(["dashboard", "u1", "negB", "2026-10-22", "7d"]);
writeCache(kA, { stats: { v: 1 } });
t("ida y vuelta", (readCache<any>(kA))?.stats?.v === 1);
t("otro usuario NO ve lo del primero", readCache(kB) === null);
t("otro negocio NO ve lo del primero", readCache(kC) === null);

// expiracion
const realNow = Date.now;
Date.now = () => realNow() + 11 * 60 * 1000;
t("pasados 10 min se ignora", readCache(kA) === null);
Date.now = realNow;
t("y se borro al vencer", fake.getItem(kA!) === null);

// dato danado
fake.setItem("rb-cache:roto", "{no es json");
t("entrada danada devuelve null sin romper", readCache("rb-cache:roto") === null);

// tope de entradas
for (let i = 0; i < 40; i++) writeCache(cacheKey(["x", "u", "n", String(i)]), { i });
let n = 0; for (let i = 0; i < fake.length; i++) if (fake.key(i)!.startsWith("rb-cache:")) n++;
t(`tope de 30 entradas (hay ${n})`, n <= 30);

// limpieza al cerrar sesion, sin tocar otras claves
fake.setItem("otra-cosa", "1");
clearAppCache();
let left = 0; for (let i = 0; i < fake.length; i++) if (fake.key(i)!.startsWith("rb-cache:")) left++;
t("clearAppCache borra todo lo de la cache", left === 0);
t("y no toca claves ajenas", fake.getItem("otra-cosa") === "1");

// sin sessionStorage disponible
(globalThis as any).sessionStorage = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); }, removeItem() { throw new Error("x"); }, key() { throw new Error("x"); }, length: 1 };
let threw = false;
try { writeCache("rb-cache:a|b", { a: 1 }); readCache("rb-cache:a|b"); clearAppCache(); } catch { threw = true; }
t("si el navegador bloquea el almacenamiento no se rompe nada", !threw);

process.exit(fails ? 1 : 0);
