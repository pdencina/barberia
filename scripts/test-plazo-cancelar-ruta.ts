// Plazo para cancelar o modificar, con las rutas reales contra la base de PRUEBAS. No borra: la cita queda anulada y el plazo se restaura.
//   npx tsx scripts/test-plazo-cancelar-ruta.ts <tenantId>
import "./_solo-con-base";
import { readFileSync } from "fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes("ucwrdmwtlesayjxmlbve")) { console.log("ABORTADO: solo contra la base de pruebas"); process.exit(1); }
delete process.env.RESEND_API_KEY; delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const T = process.argv[2];
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

(async () => {
  const { NextRequest } = require("next/server");
  const sb = require("../src/lib/supabase/server").createAdminSupabase();
  const { aHoraPared } = require("../src/lib/cancel-reasons");
  const { data: antes, error: ep } = await sb.from("tenants").select("client_change_hours").eq("id", T).single();
  if (ep) { console.log("ERROR falta la columna del plazo en pruebas:", ep.message); process.exit(1); }
  const { data: b } = await sb.from("profiles").select("id").eq("tenant_id", T).eq("role", "barber").eq("active", true).order("name").limit(1).single();
  const inicio = new Date(aHoraPared(new Date()).getTime() + 5 * 3600_000); // cita dentro de 5 horas
  const { data: a, error } = await sb.from("appointments").insert({ barber_id: b.id, tenant_id: T, date: inicio.toISOString().slice(0, 10), start_time: inicio.toISOString(), end_time: new Date(inicio.getTime() + 1800_000).toISOString(), status: "scheduled" }).select("id").single();
  if (error) throw error;
  const cancelar = async () => { const r = await require("../src/app/api/public/cancel/route").POST(new NextRequest("http://localhost/api/public/cancel", { method: "POST", body: JSON.stringify({ appointmentId: a.id }) })); return { status: r.status, d: await r.json() }; };
  const ver = async () => { const r = await require("../src/app/api/public/reschedule/route").GET(new NextRequest(`http://localhost/api/public/reschedule?id=${a.id}`)); return { status: r.status, d: await r.json() }; };
  try {
    for (const plazo of [24, 6]) {
      await sb.from("tenants").update({ client_change_hours: plazo }).eq("id", T);
      const m = await ver(), c = await cancelar();
      ok(m.status === 400 && c.status === 400 && /plazo/.test(c.d.error), `faltan 5 h y el plazo es ${plazo} h: no deja modificar ni cancelar`);
    }
    await sb.from("tenants").update({ client_change_hours: 3 }).eq("id", T);
    ok((await ver()).status === 200, "faltan 5 h y el plazo es 3 h: deja modificar");
    const c = await cancelar();
    const { data: fin } = await sb.from("appointments").select("status").eq("id", a.id).single();
    ok(c.status === 200 && fin.status === "cancelled", `y deja cancelar ${c.d.error || ""}`);
  } finally {
    await sb.from("appointments").update({ status: "cancelled" }).eq("id", a.id);
    await sb.from("tenants").update({ client_change_hours: antes.client_change_hours }).eq("id", T);
  }
  console.log(fallas ? `\n${fallas} FALLAS` : "\nTODO OK: plazo para cancelar o modificar");
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error("ERROR", e?.message || e); process.exit(1); });
