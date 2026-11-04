// Regresion: una cookie de sesion malformada (JSON sin expires_at) dejaba el servidor al 100% de CPU y sin responder.
// auth-js la ve invalida -> la "borra" -> avisa SIGNED_OUT -> realtime pide el token con getSession() -> la cookie sigue ahi
// (el remove no borraba nada) -> otra vez, para siempre y sin soltar nunca el event loop.
//
// La prueba levanta su propio `next dev` en un puerto libre, con un Supabase falso en 127.0.0.1: no toca produccion, ni la
// base de pruebas, ni el puerto 3000. Si el servidor se cuelga, lo mata con kill -9 (solo el suyo) y sigue con el resto.
// No correrla junto a otro `next dev` en esta misma carpeta (comparten .next).
// Ejecutar: npx tsx scripts/test-cookie-sesion-malformada.ts
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

const TENANT = "22222222-2222-2222-2222-222222222222";
const ACTIVO = "11111111-1111-1111-1111-111111111111";
const SUSPENDIDO = "33333333-3333-3333-3333-333333333333";
const SUSPENDIDO_TROZOS = "44444444-4444-4444-4444-444444444444";
const RENOVADO = "55555555-5555-5555-5555-555555555555";
const LIMITE_MS = 10_000;

let fails = 0;
const t = (name: string, ok: boolean, extra = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "OK " : "MAL"} ${name}${extra ? " -> " + extra : ""}`);
};

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (sub: string, exp = Math.floor(Date.now() / 1000) + 3600) =>
  `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, exp, role: "authenticated" })}.firma-falsa`;
const usuario = (id: string) => ({ id, aud: "authenticated", role: "authenticated", email: `${id}@prueba.test` });
const sesion = (id: string, extra: Record<string, unknown> = {}) => ({
  access_token: jwt(id),
  refresh_token: "refresh-de-prueba",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: "bearer",
  user: usuario(id),
  ...extra,
});

// --- Supabase falso ---
const cuenta = { total: 0, refresh: 0, user: 0, clientsConTenant: 0 };
function subDe(req: IncomingMessage): string | null {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub ?? null;
  } catch {
    return null;
  }
}
function supabaseFalso(req: IncomingMessage, res: ServerResponse) {
  let cuerpo = "";
  req.on("data", (c) => (cuerpo += c));
  req.on("end", () => {
    cuenta.total++;
    const url = new URL(req.url || "/", "http://x");
    const json = (status: number, data: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (url.pathname === "/auth/v1/user") {
      cuenta.user++;
      const sub = subDe(req);
      return sub ? json(200, usuario(sub)) : json(401, { code: 401, msg: "invalid JWT" });
    }
    if (url.pathname === "/auth/v1/token") {
      cuenta.refresh++;
      if (cuerpo.includes("refresh-bueno")) return json(200, sesion(RENOVADO));
      return json(400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
    }
    if (url.pathname === "/rest/v1/profiles") {
      const id = (url.searchParams.get("id") || "").replace("eq.", "");
      const suspendido = id === SUSPENDIDO || id === SUSPENDIDO_TROZOS;
      const fila = { id, name: "Prueba", role: "admin", tenant_id: TENANT, tenant: { name: "Negocio", status: suspendido ? "suspended" : "active" } };
      return json(200, (req.headers.accept || "").includes("vnd.pgrst.object") ? fila : [fila]);
    }
    if (url.pathname === "/rest/v1/clients" && url.searchParams.get("tenant_id") === `eq.${TENANT}`) cuenta.clientsConTenant++;
    if ((req.headers.accept || "").includes("vnd.pgrst.object")) return json(406, { code: "PGRST116", message: "0 filas" });
    return json(200, []);
  });
}

// --- Servidor Next propio ---
const escuchar = (s: ReturnType<typeof createServer>) =>
  new Promise<number>((ok) => s.listen(0, "127.0.0.1", () => ok((s.address() as AddressInfo).port)));
const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

let next: ChildProcess | null = null;
let base = "";
let supabaseUrl = "";

function matarNext() {
  if (next?.pid) {
    try {
      process.kill(-next.pid, "SIGKILL"); // grupo propio: el `next dev` de esta prueba y su next-server, nada mas
    } catch {}
  }
  next = null;
}
process.on("exit", matarNext);

async function levantarNext() {
  matarNext();
  const libre = createServer();
  const puerto = await escuchar(libre);
  await new Promise((ok) => libre.close(ok));
  if (puerto === 3000) throw new Error("nunca en el puerto 3000");
  base = `http://127.0.0.1:${puerto}`;
  next = spawn("node_modules/.bin/next", ["dev", "-p", String(puerto)], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-de-prueba",
      SUPABASE_SERVICE_ROLE_KEY: "service-de-prueba",
    },
  });
  for (let i = 0; i < 120; i++) {
    try {
      // Compila de una vez lo que se va a probar, para que el limite de cada caso no lo gaste el compilador.
      for (const ruta of ["/api/plans", "/api/clients", "/api/appointments", "/login"]) {
        await fetch(base + ruta, { redirect: "manual", signal: AbortSignal.timeout(120_000) });
      }
      return;
    } catch {
      await dormir(500);
    }
  }
  throw new Error("next dev no partio");
}

const NOMBRE = "sb-127-auth-token"; // @supabase/ssr usa el primer pedazo del host: 127.0.0.1 -> 127
const cookie = (valor: string, nombre = NOMBRE) => `${nombre}=${encodeURIComponent(valor)}`;

type Resp = { status: number; location: string; body: string } | null;
async function pedir(ruta: string, cookies: string, limite = LIMITE_MS): Promise<Resp> {
  try {
    const r = await fetch(base + ruta, {
      headers: cookies ? { cookie: cookies } : {},
      redirect: "manual",
      signal: AbortSignal.timeout(limite),
    });
    return { status: r.status, location: r.headers.get("location") || "", body: await r.text() };
  } catch {
    return null;
  }
}

// Pide y despues comprueba que el servidor siga contestando. Si se colgo, lo reinicia para probar el resto.
async function pedirYSondear(ruta: string, cookies: string, limite = LIMITE_MS): Promise<Resp> {
  const r = await pedir(ruta, cookies, limite);
  const vivo = r !== null && (await pedir("/api/plans", "", 5_000)) !== null;
  if (!vivo) await levantarNext();
  return vivo ? r : null;
}

(async () => {
  const stub = createServer(supabaseFalso);
  supabaseUrl = `http://127.0.0.1:${await escuchar(stub)}`;
  await levantarNext();

  const rutasApi = ["/api/clients", "/api/appointments"];
  // Compila las rutas y anota como responden a un anonimo: la cookie mala debe dar exactamente lo mismo.
  const anonimo: Record<string, number> = {};
  for (const ruta of [...rutasApi, "/login"]) anonimo[ruta] = (await pedir(ruta, "", 120_000))?.status ?? -1;
  t("el servidor responde a un anonimo", Object.values(anonimo).every((s) => s > 0), JSON.stringify(anonimo));
  // Primera carga del panel con sesion valida: es la que compila /dashboard (lenta), por eso con otro limite.
  const panel = await pedir("/dashboard", cookie(JSON.stringify(sesion(ACTIVO))), 240_000);
  t("sesion valida entra a /dashboard", panel?.status === 200, `status ${panel?.status}`);

  const malas: Array<[string, string]> = [
    ["JSON sin expires_at (el caso original)", cookie(JSON.stringify({ access_token: "a.b.c", refresh_token: "r", user: usuario(ACTIVO) }))],
    ["objeto vacio", cookie("{}")],
    ["solo access_token", cookie(JSON.stringify({ access_token: "a.b.c" }))],
    ["sin refresh_token", cookie(JSON.stringify({ access_token: "a.b.c", expires_at: 9999999999 }))],
    ["arreglo", cookie("[]")],
    ["numero", cookie("1")],
    ["booleano", cookie("true")],
    ["texto JSON", cookie('"hola"')],
    ["null", cookie("null")],
    ["no es JSON", cookie("{esto no es json")],
    ["prefijo base64-", cookie(`base64-${Buffer.from("{}").toString("base64")}`)],
    ["vacia", `${NOMBRE}=`],
    ["porcentajes rotos", `${NOMBRE}=%E0%A4%A`],
    ["en trozos, sin expires_at", `${cookie('{"access_token":"a.b.c",', `${NOMBRE}.0`)}; ${cookie('"refresh_token":"r"}', `${NOMBRE}.1`)}`],
  ];
  for (const [nombre, c] of malas) {
    for (const ruta of rutasApi) {
      const r = await pedirYSondear(ruta, c);
      t(`${ruta} con cookie mala: ${nombre}`, r?.status === anonimo[ruta], r ? `status ${r.status} (anonimo ${anonimo[ruta]})` : "SERVIDOR COLGADO");
    }
  }

  // Parte de un JWT bien formado y vigente, asi que /dashboard se salta la validacion del middleware y llega al layout.
  const sinVencimiento = cookie(JSON.stringify({ access_token: jwt(ACTIVO), refresh_token: "r", user: usuario(ACTIVO) }));
  let r = await pedirYSondear("/dashboard", sinVencimiento);
  t("/dashboard con JWT vigente y sin expires_at manda al login", r?.status === 307 && r.location.includes("/login"), r ? `status ${r.status} -> ${r.location}` : "SERVIDOR COLGADO");
  r = await pedirYSondear("/dashboard", cookie("{}"));
  t("/dashboard con cookie mala manda al login", r?.status === 307 && r.location.includes("/login"), r ? `status ${r.status} -> ${r.location}` : "SERVIDOR COLGADO");
  r = await pedirYSondear("/login", cookie("{}"));
  t("/login con cookie mala se muestra", r?.status === anonimo["/login"], r ? `status ${r.status}` : "SERVIDOR COLGADO");

  // Sesiones validas: nada debe cambiar.
  const antes = cuenta.clientsConTenant;
  r = await pedirYSondear("/api/clients", cookie(JSON.stringify(sesion(ACTIVO))));
  t("sesion valida lee clientes de SU negocio", r?.status === 200 && cuenta.clientsConTenant > antes, r ? `status ${r.status}` : "SERVIDOR COLGADO");
  r = await pedirYSondear("/login", cookie(JSON.stringify(sesion(ACTIVO))));
  t("sesion valida en /login va al panel", r?.status === 307 && r.location.includes("/dashboard"), r ? `status ${r.status} -> ${r.location}` : "SERVIDOR COLGADO");
  r = await pedirYSondear("/api/clients", cookie(JSON.stringify(sesion(SUSPENDIDO))));
  t("negocio suspendido sigue bloqueado (402)", r?.status === 402 && r.body.includes("tenant_suspended"), r ? `status ${r.status}` : "SERVIDOR COLGADO");
  const entera = encodeURIComponent(JSON.stringify(sesion(SUSPENDIDO_TROZOS)));
  const corte = Math.floor(entera.length / 2);
  r = await pedirYSondear("/api/clients", `${NOMBRE}.0=${entera.slice(0, corte)}; ${NOMBRE}.1=${entera.slice(corte)}`.replace(/%(?=[0-9A-F]?;)/g, ""));
  t("sesion valida en trozos se sigue leyendo (402)", r?.status === 402, r ? `status ${r.status}` : "SERVIDOR COLGADO");

  // Sesion vencida: se renueva (o se descarta) sin dejar un bucle pidiendole tokens a Supabase.
  const vencida = (refresh: string) =>
    cookie(JSON.stringify(sesion(ACTIVO, { access_token: jwt(ACTIVO, 1000), expires_at: 1000, refresh_token: refresh })));
  r = await pedirYSondear("/api/clients", vencida("refresh-bueno"));
  t("sesion vencida con refresh bueno responde", r?.status === 200, r ? `status ${r.status}` : "SERVIDOR COLGADO");
  r = await pedirYSondear("/api/clients", vencida("refresh-revocado"));
  t("sesion vencida con refresh revocado responde como anonimo", r?.status === anonimo["/api/clients"], r ? `status ${r.status}` : "SERVIDOR COLGADO");
  await dormir(500);
  const quieto = cuenta.total;
  await dormir(2_000);
  t("nada sigue llamando a Supabase por detras", cuenta.total === quieto, `${cuenta.total - quieto} llamadas en 2 s; refresh en total: ${cuenta.refresh}`);

  matarNext();
  stub.close();
  console.log(fails ? `\n${fails} prueba(s) MAL` : "\nTodo OK");
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
