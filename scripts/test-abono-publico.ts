// La lectura del abono es pública y por negocio (la página de reservas no tiene sesión). Uso: npx tsx scripts/test-abono-publico.ts
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co"; process.env.SUPABASE_SERVICE_ROLE_KEY = "svc"; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
let consultas: string[] = [];
(globalThis as any).fetch = async (url: any) => {
  const u = String(url); consultas.push(u);
  if (u.includes("/tenant_settings")) return new Response(JSON.stringify({ deposit_enabled: true, deposit_percentage: 30, deposit_fixed_amount: 1000, deposit_mode: "fixed", cancellation_free_hours: 24, deposit_message: "Abono", mp_access_token: "SECRETO" }), { status: 200, headers: { "content-type": "application/json" } });
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
};
(async () => {
  const { GET } = await import("../src/app/api/settings/deposit/route");
  const id = "30c7343c-1ace-4b39-adb5-31ba410c2b51";
  const res = await GET(new NextRequest(`http://localhost:3000/api/settings/deposit?tenantId=${id}`));
  const j = await res.json();
  let fallas = 0; const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fallas++; console.log("MAL " + n + ": " + e.message); } };
  t("sin sesión devuelve la configuración del negocio pedido (no vacío)", () => { assert.equal(j.deposit_enabled, true); assert.equal(j.deposit_mode, "fixed"); assert.equal(j.deposit_fixed_amount, 1000); });
  t("consulta ese negocio y no otro", () => { assert.ok(consultas.some((u) => u.includes(id)), consultas.join("\n")); });
  t("nunca devuelve tokens", () => { assert.ok(!JSON.stringify(j).includes("SECRETO")); assert.ok(!("mp_access_token" in j) && !("mp_online_access_token" in j)); });
  t("un tenantId que no es un UUID no consulta nada raro", async () => { consultas = []; const r2 = await GET(new NextRequest("http://localhost:3000/api/settings/deposit?tenantId=1;drop")); assert.deepEqual(await r2.json(), {}); });
  process.exit(fallas ? 1 : 0);
})();
