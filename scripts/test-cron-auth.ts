// Pruebas de src/lib/cron-auth.ts (clave de las tareas programadas). Ejecutar: npx tsx scripts/test-cron-auth.ts
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-de-prueba";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-de-prueba";
import { verifyCron } from "../src/lib/cron-auth";
import { NextRequest } from "next/server";

let fails = 0;
const t = (n: string, ok: boolean, x = "") => { if (!ok) fails++; console.log(`${ok ? "OK " : "MAL"} ${n}${x ? " -> " + x : ""}`); };
const req = (auth?: string) => new Request("http://localhost/api/cron/x", { headers: auth ? { authorization: auth } : {} });

(async () => {
  const off = console.error; console.error = () => {};
  let r = verifyCron(req(), { CRON_SECRET: "s3", NODE_ENV: "production" });
  t("con clave y sin encabezado: 401", r?.status === 401);
  r = verifyCron(req("Bearer otra"), { CRON_SECRET: "s3", NODE_ENV: "production" });
  t("con clave y encabezado distinto: 401", r?.status === 401);
  r = verifyCron(req("s3"), { CRON_SECRET: "s3", NODE_ENV: "production" });
  t("encabezado sin 'Bearer': 401", r?.status === 401);
  r = verifyCron(req("Bearer s3"), { CRON_SECRET: "s3", NODE_ENV: "production" });
  t("con clave y encabezado correcto: pasa", r === null);
  r = verifyCron(req(), { NODE_ENV: "production" });
  t("produccion SIN clave configurada: 503 (falla cerrado)", r?.status === 503);
  r = verifyCron(req("Bearer undefined"), { NODE_ENV: "production" });
  t("produccion sin clave y 'Bearer undefined': 503 (antes pasaba)", r?.status === 503);
  r = verifyCron(req(), { CRON_SECRET: "", NODE_ENV: "production" });
  t("clave vacia en produccion: 503", r?.status === 503);
  r = verifyCron(req(), { NODE_ENV: "development" });
  t("desarrollo sin clave: pasa (para probar a mano)", r === null);

  // Las rutas reales: sin clave en produccion no deben tocar la base ni la red.
  let red = 0; (globalThis as any).fetch = async () => { red++; throw new Error("no debe llegar a la red"); };
  const prevEnv = { ...process.env }; (process.env as any).NODE_ENV = "production"; delete process.env.CRON_SECRET;
  for (const ruta of ["reminders", "post-service", "referral-benefits"]) {
    const mod = await import(`../src/app/api/cron/${ruta}/route`);
    const res: Response = await mod.GET(new NextRequest(`http://localhost:3000/api/cron/${ruta}`));
    t(`/api/cron/${ruta} sin clave en produccion: 503 y sin red`, res.status === 503 && red === 0, `status ${res.status}, red ${red}`);
    process.env.CRON_SECRET = "s3";
    const res2: Response = await mod.GET(new NextRequest(`http://localhost:3000/api/cron/${ruta}`));
    t(`/api/cron/${ruta} con clave y sin encabezado: 401 y sin red`, res2.status === 401 && red === 0, `status ${res2.status}, red ${red}`);
    delete process.env.CRON_SECRET;
  }
  Object.assign(process.env, prevEnv); console.error = off;
  process.exit(fails ? 1 : 0);
})();
