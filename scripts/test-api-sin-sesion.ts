// Regresion de seguridad: estas rutas GET devolvian datos de TODOS los negocios a cualquiera sin iniciar sesion.
// Esta prueba llama a las rutas reales sin cookies y exige 401/403, sin llegar a consultar la base ni la red.
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

// Cada ruta con los parametros que antes la dejaban entregar datos (o que hacian que llegara al codigo de la ruta).
const ID = "11111111-1111-1111-1111-111111111111";
const rutas: string[] = [
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
  // segunda tanda
  "caja?date=2026-10-20",
  "appointments/week?start=2026-10-19",
  "analytics/products?days=3650",
  "booking-metrics?days=3650",
  "waitlist?status=all",
  `barber/blocks?barberId=${ID}`,
  `barber-services?barberId=${ID}`,
  `barber-service-assignments?barberId=${ID}`,
  `mercadopago?barberId=${ID}`,
  "mercadopago/devices",
  `mercadopago/status?id=x&barberId=${ID}`,
  `tuu/status?id=x&barberId=${ID}`,
  "cupones/validate?code=PRUEBA&amount=1000",
  // historial de campanas de Retencion
  "retention/campaigns",
];

let fails = 0;
const t = (name: string, ok: boolean, extra = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "OK " : "MAL"} ${name}${extra ? " -> " + extra : ""}`);
};

(async () => {
  for (const r of rutas) {
    const [ruta, query = ""] = r.split("?");
    const mod = await import(`../src/app/api/${ruta}/route`);
    // Tambien con un tenantId de otro negocio en la URL: sin sesion tampoco debe servir.
    const ajeno = "tenantId=00000000-0000-0000-0000-000000000000";
    for (const qs of [query ? `?${query}` : "", `?${query ? query + "&" : ""}${ajeno}`]) {
      networkCalls = 0;
      const res: Response = await mod.GET(new NextRequest(`http://localhost:3000/api/${ruta}${qs}`));
      let body: any = null;
      try { body = await res.json(); } catch { /* sin cuerpo JSON */ }
      const sinDatos = body && !Array.isArray(body) && Object.keys(body).length === 1 && typeof body.error === "string";
      const cerrada = res.status === 401 || res.status === 403;
      t(`/api/${ruta}${qs.includes("tenantId") ? " (con tenantId ajeno)" : ""} sin sesion`, cerrada && sinDatos && networkCalls === 0, `status ${res.status}, llamadas a la red: ${networkCalls}`);
    }
  }
  // Rutas con parametro en la URL ([id]): sin sesion tampoco deben leer, editar ni borrar nada.
  const escritura: Array<{ ruta: string; metodo: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; params: Record<string, string>; qs?: string }> = [
    { ruta: "cupones/[id]", metodo: "PATCH", params: { id: ID } },
    { ruta: "cupones/[id]", metodo: "DELETE", params: { id: ID } },
    { ruta: "retention/campaigns/[id]", metodo: "GET", params: { id: ID } },
    // servicios y sus fotos: antes cualquiera con el id podia editarlos, desactivarlos o cambiarles la foto
    { ruta: "services/[id]", metodo: "PATCH", params: { id: ID } },
    { ruta: "services/[id]", metodo: "DELETE", params: { id: ID } },
    { ruta: "services/[id]/photo", metodo: "POST", params: { id: ID } },
    { ruta: "services/[id]/photo", metodo: "DELETE", params: { id: ID } },
    // escrituras de dinero y de agenda que antes no pedian sesion
    { ruta: "arriendo", metodo: "POST", params: {} },
    { ruta: "arriendo", metodo: "PATCH", params: {} },
    { ruta: "comisiones", metodo: "POST", params: {} },
    { ruta: "comisiones", metodo: "PATCH", params: {} },
    { ruta: "barber-services", metodo: "POST", params: {} },
    { ruta: "barber-service-assignments", metodo: "POST", params: {} },
    { ruta: "barber/blocks", metodo: "PATCH", params: {}, qs: `?id=${ID}` },
    { ruta: "products/[id]", metodo: "PATCH", params: { id: ID } },
    { ruta: "gallery", metodo: "POST", params: {} },
    { ruta: "gallery", metodo: "DELETE", params: {}, qs: `?id=${ID}` },
    { ruta: "gallery/upload", metodo: "POST", params: {} },
    { ruta: "invite-codes", metodo: "POST", params: {} },
    { ruta: "invite-codes", metodo: "DELETE", params: {}, qs: `?id=${ID}` },
    { ruta: "waitlist", metodo: "PATCH", params: {} },
    { ruta: "waitlist/notify", metodo: "POST", params: {} },
    { ruta: "boletas/emit", metodo: "POST", params: {} },
    { ruta: "boletas/send", metodo: "POST", params: {} },
    // cobros en el terminal de tarjeta
    { ruta: "tuu", metodo: "POST", params: {} },
    { ruta: "tuu/cancel", metodo: "POST", params: {} },
    { ruta: "mercadopago", metodo: "POST", params: {} },
    { ruta: "mercadopago/cancel", metodo: "POST", params: {} },
  ];
  for (const e of escritura) {
    const mod = await import(`../src/app/api/${e.ruta}/route`);
    networkCalls = 0;
    const init: any = { method: e.metodo, headers: { "content-type": "application/json" } };
    if (e.metodo === "PATCH" || e.metodo === "POST" || e.metodo === "PUT") init.body = JSON.stringify({ active: false, barberId: ID, idempotencyKey: ID, orderId: ID, cancelAll: true, recordId: ID, id: ID, status: "notified", waitlistId: ID, transactionId: ID, email: "prueba@example.com", serviceId: ID, serviceIds: [], commissionRate: 40, month: 10, year: 2026, daysWorked: 1, amount: 1 });
    const res: Response = await mod[e.metodo](new NextRequest(`http://localhost:3000/api/${e.ruta.replace("[id]", ID)}${e.qs ?? ""}`, init), { params: e.params });
    const cerrada = res.status === 401 || res.status === 403;
    t(`${e.metodo} /api/${e.ruta} sin sesion`, cerrada && networkCalls === 0, `status ${res.status}, llamadas a la red: ${networkCalls}`);
  }
  process.exit(fails ? 1 : 0);
})();
