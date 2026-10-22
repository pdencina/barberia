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
t("texto vacio (sin busqueda) si forma clave", cacheKey(["clientes", "u1", "neg", ""]) !== null);
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

// --- almacen en memoria ---
(globalThis as any).sessionStorage = fake;
const kM = cacheKey(["clientes", "u1", "negA", "", "1"]);
writeCache(kM, { clients: [{ id: "a" }] }, "memory");
t("memoria: ida y vuelta", (readCache<any>(kM, undefined, "memory"))?.clients?.[0]?.id === "a");
t("memoria: NO queda escrito en sessionStorage", fake.getItem(kM!) === null);
t("memoria: leer como 'session' no lo encuentra", readCache(kM) === null);
const m1 = readCache<any>(kM, undefined, "memory"); m1.clients.push({ id: "z" });
t("memoria: modificar lo leido no altera lo guardado", readCache<any>(kM, undefined, "memory").clients.length === 1);
const realNow2 = Date.now;
Date.now = () => realNow2() + 11 * 60 * 1000;
t("memoria: pasados 10 min se ignora", readCache(kM, undefined, "memory") === null);
Date.now = realNow2;
for (let i = 0; i < 45; i++) writeCache(cacheKey(["m", "u", "n", String(i)]), { i }, "memory");
t("memoria: el mas antiguo salio por el tope", readCache(cacheKey(["m", "u", "n", "0"]), undefined, "memory") === null && readCache<any>(cacheKey(["m", "u", "n", "44"]), undefined, "memory")?.i === 44);
writeCache(kM, { x: 1 }, "memory");
clearAppCache();
t("clearAppCache tambien vacia la memoria", readCache(kM, undefined, "memory") === null);

process.exit(fails ? 1 : 0);
