// Prueba de «Ver mi código» del tótem (QR -> correo en el celular -> código al tótem). Usa la base de PRUEBAS y limpia lo que crea.
//   npx tsx scripts/test-kiosk-vinculo.ts <tenantId> <codigoNegocio>
import { NextRequest } from "next/server";
import { POST as crear } from "../src/app/api/totem/vincular/crear/route";
import { GET as estadoGet } from "../src/app/api/totem/vincular/estado/route";
import { POST as asociar } from "../src/app/api/totem/vincular/asociar/route";
import { POST as accion } from "../src/app/api/totem/vincular/accion/route";

const [tenantId, codigoNegocio] = process.argv.slice(2);
const { createAdminSupabase } = require("../src/lib/supabase/server");
const sb = createAdminSupabase();
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };
let n = 0;
const ip = () => ({ "x-forwarded-for": `10.9.0.${++n}` });
const post = (h: any, body: any) => h(new NextRequest("http://x/api", { method: "POST", headers: ip(), body: JSON.stringify(body) }));
const estado = async (token: string, codigo = codigoNegocio) => (await (await estadoGet(new NextRequest(`http://x/api?codigo=${codigo}&t=${token}`, { headers: ip() }))).json());

(async () => {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
  const { data: barber } = await sb.from("profiles").select("id").eq("tenant_id", tenantId).eq("role", "barber").limit(1).single();
  const correo = "cliente.vinculo.prueba@example.com";
  const { data: cli } = await sb.from("clients").insert({ name: "Cliente Vinculo Prueba", phone: "+56911114040", email: correo, tenant_id: tenantId }).select("id, checkin_code").single();
  const { data: sinCita } = await sb.from("clients").insert({ name: "Cliente SinCita Prueba", phone: "+56911115050", email: "sin.cita.prueba@example.com", tenant_id: tenantId }).select("id").single();
  const { data: ap } = await sb.from("appointments").insert({ client_id: cli.id, barber_id: barber.id, date: hoy, start_time: `${hoy}T18:00:00Z`, end_time: `${hoy}T18:30:00Z`, status: "scheduled", tenant_id: tenantId }).select("id").single();
  const { data: antes } = await sb.from("tenants").select("kiosk_enabled, kiosk_unlocked").eq("id", tenantId).single();
  await sb.from("tenants").update({ kiosk_enabled: true, kiosk_unlocked: true }).eq("id", tenantId);
  const tokens: string[] = [];
  try {
    let r = await post(crear, { codigo: "AAAAAAA", modo: "pagar" }); ok(r.status === 404, "código de negocio falso: no crea sesión");
    r = await post(crear, { codigo: codigoNegocio, modo: "pagar" }); let d = await r.json(); tokens.push(d.token);
    ok(r.status === 200 && /^[A-Z0-9]{10}$/.test(d.token) && d.url.includes(`/mi-codigo?t=${d.token}`), "crea la sesión y el enlace del QR");
    const t1 = d.token;
    ok((await estado(t1)).estado === "esperando", "el tótem ve «esperando» mientras el cliente no escribe su correo");
    ok((await estado(t1, "ZZZZZZZ")).estado === "expirado", "con otro código de negocio no se puede leer la sesión");

    r = await post(asociar, { t: t1, email: "correo-malo" }); ok(r.status === 400, "correo con formato inválido: se rechaza");
    r = await post(asociar, { t: t1, email: "sin.cita.prueba@example.com" }); ok(r.status === 404, "cliente SIN cita hoy: no se revela (mismo mensaje que un correo desconocido)");
    r = await post(asociar, { t: t1, email: "no.existe@example.com" }); ok(r.status === 404, "correo desconocido: 404");
    ok((await estado(t1)).estado === "esperando", "los intentos fallidos no entregan nada al tótem");

    r = await post(asociar, { t: t1, email: correo.toUpperCase() }); d = await r.json();
    ok(r.status === 200 && d.code === cli.checkin_code && d.cita?.hora === "18:00", `correo correcto (sin distinguir mayúsculas): devuelve su código fijo ${d.code} y su cita`);
    let e = await estado(t1); ok(e.estado === "vinculado" && e.code === cli.checkin_code, "el tótem ve «vinculado» con el código");
    r = await post(accion, { t: t1, accion: "pagar" }); ok(r.status === 200, "el cliente toca «Ir a pagar»");
    e = await estado(t1); ok(e.estado === "listo" && e.code === cli.checkin_code && e.accion === "pagar", "el tótem recibe código + acción «pagar» y avanza solo");

    // acción sin haber puesto el correo
    r = await post(crear, { codigo: codigoNegocio, modo: "llegue" }); d = await r.json(); tokens.push(d.token);
    r = await post(accion, { t: d.token, accion: "pagar" }); ok(r.status === 400, "no se puede elegir una acción sin haber escrito el correo");

    // tope de intentos por QR
    r = await post(crear, { codigo: codigoNegocio, modo: "llegue" }); d = await r.json(); tokens.push(d.token); const t3 = d.token;
    for (let i = 0; i < 5; i++) await post(asociar, { t: t3, email: `x${i}@example.com` });
    r = await post(asociar, { t: t3, email: correo }); ok(r.status === 429, "tras 5 correos probados el QR se bloquea (incluso con el correo correcto)");

    // vencimiento
    r = await post(crear, { codigo: codigoNegocio, modo: "llegue" }); d = await r.json(); tokens.push(d.token); const t4 = d.token;
    await sb.from("kiosk_links").update({ created_at: new Date(Date.now() - 7 * 60_000).toISOString() }).eq("token", t4);
    r = await post(asociar, { t: t4, email: correo }); ok(r.status === 410, "QR de más de 6 minutos: vencido (410)");
    ok((await estado(t4)).estado === "expirado", "el tótem ve «expirado»");
  } finally {
    for (const t of tokens) await sb.from("kiosk_links").delete().eq("token", t);
    await sb.from("appointments").delete().eq("id", ap.id);
    await sb.from("clients").delete().in("id", [cli.id, sinCita.id]);
    await sb.from("tenants").update(antes).eq("id", tenantId);
  }
  console.log(fallas ? `\n${fallas} FALLA(S)` : "\nTodo OK"); process.exit(fallas ? 1 : 0);
})();
