// Regresion de seguridad: estas rutas GET devolvian datos de TODOS los negocios a cualquiera sin iniciar sesion.
// Esta prueba llama a las rutas reales sin cookies y exige 401, sin llegar a consultar la base ni la red.
// Ejecutar: npx tsx scripts/test-api-sin-sesion.ts
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-de-prueba";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-de-prueba";

import { NextRequest } from "next/server";

let networkCalls = 0;
(globalThis as any).fetch = async () => {
  networkCalls++;
  throw new Error("la prueba no debe llegar a la red");
};

const rutas = [
  "appointments",
  "arriendo",
  "business-hours",
  "comisiones",
  "inventario/movements",
  "invoices",
  "loyalty",
  "price-history",
  "reportes/comparison",
  "finanzas",
];

let fails = 0;
const t = (name: string, ok: boolean, extra = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "OK " : "MAL"} ${name}${extra ? " -> " + extra : ""}`);
};

(async () => {
  for (const r of rutas) {
    const mod = await import(`../src/app/api/${r}/route`);
    // Tambien con un tenantId de otro negocio en la URL: sin sesion tampoco debe servir.
    for (const qs of ["", "?tenantId=00000000-0000-0000-0000-000000000000"]) {
      networkCalls = 0;
      const res: Response = await mod.GET(new NextRequest(`http://localhost:3000/api/${r}${qs}`));
      let body: any = null;
      try { body = await res.json(); } catch { /* sin cuerpo JSON */ }
      const sinDatos = body && !Array.isArray(body) && Object.keys(body).length === 1 && typeof body.error === "string";
      t(`/api/${r}${qs ? " (con tenantId ajeno)" : ""} sin sesion`, res.status === 401 && sinDatos && networkCalls === 0, `status ${res.status}, llamadas a la red: ${networkCalls}`);
    }
  }
  process.exit(fails ? 1 : 0);
})();
