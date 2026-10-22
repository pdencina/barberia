// Pruebas del atajo de sesion del middleware (src/lib/supabase/token-fresh.ts y updateSession).
// Ejecutar: npx tsx scripts/test-token-fresh.ts
// El cliente de Supabase deduce el nombre de la cookie (sb-<ref>-auth-token) de la URL: se fija una de mentira, como en produccion.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-de-prueba";

import { NextRequest } from "next/server";
import { hasFreshSessionToken } from "../src/lib/supabase/token-fresh";

const b64u = (o: any) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const nowS = Math.floor(Date.now() / 1000);
const jwt = (exp: number, sub: string | null = "u1") => `${b64u({ alg: "HS256" })}.${b64u(sub === null ? { exp } : { exp, sub })}.firma`;
// Igual que una sesion real de Supabase (incluye expires_at: sin el, Supabase la trata como "sin sesion" y ni consulta la red).
const sess = (exp: number, extra: any = {}) => JSON.stringify({ access_token: jwt(exp), refresh_token: "r", expires_at: exp, expires_in: 3600, token_type: "bearer", user: { id: "u1", aud: "authenticated", email: "a@b.cl" }, ...extra });
const ck = (...c: [string, string][]) => ({ getAll: () => c.map(([name, value]) => ({ name, value })) });

let fails = 0;
const t = (name: string, ok: boolean, extra = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "OK " : "MAL"} ${name}${extra ? " -> " + extra : ""}`);
};

// ---------- 1) la decision, sola ----------
const now = Date.now();
t("vigente (50 min)", hasFreshSessionToken(ck(["sb-abc-auth-token", encodeURIComponent(sess(nowS + 3000))]), now) === true);
t("vence en 4 min -> validacion completa", hasFreshSessionToken(ck(["sb-abc-auth-token", sess(nowS + 240)]), now) === false);
t("vence en 6 min -> atajo", hasFreshSessionToken(ck(["sb-abc-auth-token", sess(nowS + 360)]), now) === true);
t("vencido", hasFreshSessionToken(ck(["sb-abc-auth-token", sess(nowS - 10)]), now) === false);
t("sin cookie", hasFreshSessionToken(ck(), now) === false);
t("cookie ajena", hasFreshSessionToken(ck(["otra", sess(nowS + 3000)]), now) === false);
t("cookie de verificador (no es la sesion)", hasFreshSessionToken(ck(["sb-abc-auth-token-code-verifier", sess(nowS + 3000)]), now) === false);
t("basura", hasFreshSessionToken(ck(["sb-abc-auth-token", "%%%no-json"]), now) === false);
t("sin access_token", hasFreshSessionToken(ck(["sb-abc-auth-token", JSON.stringify({ refresh_token: "r" })]), now) === false);
t("sin refresh_token", hasFreshSessionToken(ck(["sb-abc-auth-token", JSON.stringify({ access_token: jwt(nowS + 3000) })]), now) === false);
t("token sin sub", hasFreshSessionToken(ck(["sb-abc-auth-token", JSON.stringify({ access_token: jwt(nowS + 3000, null), refresh_token: "r" })]), now) === false);
t("token con 2 partes", hasFreshSessionToken(ck(["sb-abc-auth-token", JSON.stringify({ access_token: "a.b", refresh_token: "r" })]), now) === false);
t("exp como texto (no numero)", hasFreshSessionToken(ck(["sb-abc-auth-token", JSON.stringify({ access_token: `${b64u({})}.${b64u({ exp: "9999999999", sub: "u" })}.f`, refresh_token: "r" })]), now) === false);
const full = encodeURIComponent(sess(nowS + 3000));
t("cookie en trozos .0/.1 (desordenados)", hasFreshSessionToken(ck(["sb-abc-auth-token.1", full.slice(40)], ["sb-abc-auth-token.0", full.slice(0, 40)]), now) === true);
t("formato base64-", hasFreshSessionToken(ck(["sb-abc-auth-token", "base64-" + b64u(sess(nowS + 3000))]), now) === true);
t("nombre con acentos en el usuario (UTF-8)", hasFreshSessionToken(ck(["sb-abc-auth-token", encodeURIComponent(sess(nowS + 3000, { user: { name: "María Ñandú" } }))]), now) === true);

// ---------- 2) el middleware real, contando llamadas a Supabase ----------
let fetchCalls = 0;
let fetchStatus = 401;
(globalThis as any).fetch = async () => {
  fetchCalls++;
  return new Response(JSON.stringify({ message: "invalid" }), { status: fetchStatus, headers: { "content-type": "application/json" } });
};

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });
const cookieHdr = (value: string) => `sb-abc-auth-token=${encodeURIComponent(value)}`;
const location = (r: Response) => r.headers.get("location") || "";

async function run(label: string, path: string, cookie: string | undefined, expect: { calls: "ninguna" | "alguna"; redirect: string | null }) {
  fetchCalls = 0;
  const res = await (globalThis as any).__updateSession(req(path, cookie));
  const loc = location(res);
  const redirected = res.status >= 300 && res.status < 400;
  const okCalls = expect.calls === "ninguna" ? fetchCalls === 0 : fetchCalls > 0;
  const okRedirect = expect.redirect === null ? !redirected : redirected && loc.endsWith(expect.redirect);
  t(label, okCalls && okRedirect, `llamadas a Supabase: ${fetchCalls}, ${redirected ? "redirige a " + loc.replace("http://localhost:3000", "") : "deja pasar"}`);
}

(async () => {
  const { updateSession } = await import("../src/lib/supabase/middleware");
  (globalThis as any).__updateSession = updateSession;
  await run("/dashboard con sesion vigente: NO llama a Supabase y deja pasar", "/dashboard/clientes", cookieHdr(sess(nowS + 3000)), { calls: "ninguna", redirect: null });
  await run("/dashboard con sesion por vencer: validacion completa (Supabase dice no) -> /login", "/dashboard/clientes", cookieHdr(sess(nowS + 240)), { calls: "alguna", redirect: "/login" });
  await run("/dashboard con sesion vencida: validacion completa -> /login", "/dashboard", cookieHdr(sess(nowS - 100)), { calls: "alguna", redirect: "/login" });
  await run("/dashboard sin cookie -> /login", "/dashboard", undefined, { calls: "ninguna", redirect: "/login" });
  await run("/dashboard con cookie basura -> /login", "/dashboard", "sb-abc-auth-token=%%%basura", { calls: "ninguna", redirect: "/login" });
  // Anti-bucle: sesion revocada con token que parece vigente. /login debe validar de verdad y NO mandar a /dashboard.
  await run("/login con token vigente pero revocado: valida con Supabase y NO redirige (sin bucle)", "/login", cookieHdr(sess(nowS + 3000)), { calls: "alguna", redirect: null });
  // Si Supabase confirma la sesion en /login, sigue mandando a /dashboard como antes.
  fetchStatus = 200;
  (globalThis as any).fetch = async () => {
    fetchCalls++;
    return new Response(JSON.stringify({ id: "u1", aud: "authenticated", role: "authenticated", email: "a@b.cl" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  await run("/login con sesion valida (Supabase confirma): redirige a /dashboard como siempre", "/login", cookieHdr(sess(nowS + 3000)), { calls: "alguna", redirect: "/dashboard" });
  process.exit(fails ? 1 : 0);
})();
