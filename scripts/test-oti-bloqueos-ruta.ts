// Ruta de Oti «quitar bloqueos» contra la base de PRUEBAS: quita y DESHACE, así todo queda como estaba más 3 bloqueos de prueba (año 2031).
// La sesión se simula. Uso: npx tsx scripts/test-oti-bloqueos-ruta.ts <tenantId>
import "./_solo-con-base";
import { readFileSync } from "fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes("ucwrdmwtlesayjxmlbve")) { console.log("ABORTADO: solo contra la base de pruebas"); process.exit(1); }

const T = process.argv[2];
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

(async () => {
  const ruta = require.resolve("../src/lib/supabase/server");
  const real = require(ruta);
  let yo = "", permitido = true;
  require.cache[ruta]!.exports = { ...real, createAdminSupabase: real.createAdminSupabase, authorizeBarberManagement: async () => ({ ok: permitido, self: true, role: "admin", tenantId: T, userId: yo }) };
  const { NextRequest } = require("next/server");
  const { GET, POST } = require("../src/app/api/oti/bloqueos/route");
  const sb = real.createAdminSupabase();
  const { data: b } = await sb.from("profiles").select("id").eq("tenant_id", T).eq("role", "barber").eq("active", true).order("name").limit(1).single();
  yo = b.id;
  const ver = async () => (await GET(new NextRequest(`http://localhost/api/oti/bloqueos?barberId=${b.id}`))).json();
  const hacer = async (body: any) => { const r = await POST(new NextRequest("http://localhost/api/oti/bloqueos", { method: "POST", body: JSON.stringify({ barberId: b.id, ...body }) })); return { status: r.status, d: await r.json() }; };
  const previo = (await ver()).total;
  const { error } = await sb.from("barber_blocks").insert([1, 2, 3].map((n) => ({ barber_id: b.id, date: `2031-01-0${n}`, all_day: false, start_time: "10:00", end_time: "11:00", reason: "Prueba Oti" })));
  if (error) throw error;
  const antes = await ver();
  ok(antes.total === previo + 3 && antes.horario.length > 0, `1. cuenta los bloqueos (${antes.total}) y resume el horario`);
  permitido = false;
  ok((await hacer({ accion: "quitar" })).status === 403 && (permitido = true) && (await ver()).total === antes.total, "2. sin permiso no toca nada");
  const q = await hacer({ accion: "quitar" });
  ok(q.status === 200 && q.d.quitados === antes.total && !!q.d.respaldo, `3. quita ${q.d.quitados} ${q.d.error || ""}`);
  ok((await ver()).total === 0, "4. no queda ninguno desde hoy");
  const u = await hacer({ accion: "deshacer", respaldo: q.d.respaldo });
  ok(u.status === 200 && (await ver()).total === antes.total, `5. deshacer los devuelve todos ${u.d.error || ""}`);
  const otra = await hacer({ accion: "deshacer", respaldo: q.d.respaldo });
  ok(otra.status === 200 && (await ver()).total === antes.total, "6. deshacer dos veces no duplica");
  console.log(fallas ? `\n${fallas} FALLAS` : "\nTODO OK: quitar bloqueos desde Oti");
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error("ERROR", e?.message || e); process.exit(1); });
