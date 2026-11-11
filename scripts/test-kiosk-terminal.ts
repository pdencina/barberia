// Prueba del cobro en máquina del tótem con TUU y Mercado Pago SIMULADOS. Usa la base de PRUEBAS y limpia lo que crea.
//   npx tsx scripts/test-kiosk-terminal.ts <tenantId> <codigoNegocio>
import { NextRequest } from "next/server";
import { POST as pagoTerminal } from "../src/app/api/totem/pago-terminal/route";
import { GET as pagoEstado } from "../src/app/api/totem/pago-estado/route";
import { POST as pagoCancelar } from "../src/app/api/totem/pago-cancelar/route";

const [tenantId, codigoNegocio] = process.argv.slice(2);
const { createAdminSupabase } = require("../src/lib/supabase/server");
const sb = createAdminSupabase();
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

// ---- proveedores simulados
let tuuEstado: any = { status: 0 };
let tuuHttp = 200;
let mpOrden: any = { status: "created" };
const llamadas: string[] = [];
const fetchReal = global.fetch;
(global as any).fetch = async (u: any, i?: any) => {
  const url = String(u);
  if (url.includes("integrations.payment.haulmer.com")) {
    llamadas.push(`TUU ${i?.method || "GET"} ${url.split("/RemotePayment/")[1]}`);
    if (url.endsWith("/Create")) return new Response(JSON.stringify({ ok: true }), { status: 200 });
    return new Response(JSON.stringify(tuuEstado), { status: tuuHttp });
  }
  if (url.startsWith("https://api.mercadopago.com/v1/orders")) {
    llamadas.push(`MP ${i?.method || "GET"} ${url.replace("https://api.mercadopago.com/v1/", "")}`);
    if (url.endsWith("/orders") && i?.method === "POST") return new Response(JSON.stringify({ id: "ORD123" }), { status: 201 });
    if (url.endsWith("/process") || url.endsWith("/cancel")) return new Response("{}", { status: 200 });
    return new Response(JSON.stringify(mpOrden), { status: 200 });
  }
  return fetchReal(u, i);
};

let ipN = 0; // cada llamada con otra IP: el límite de intentos por IP no debe interferir con la prueba
const post = (h: any, body: any) => h(new NextRequest("http://x/api", { method: "POST", headers: { "x-forwarded-for": `10.0.0.${++ipN}` }, body: JSON.stringify({ codigo: codigoNegocio, ...body }) }));
const estado = async (id: string) => (await (await pagoEstado(new NextRequest(`http://x/api?codigo=${codigoNegocio}&id=${id}`, { headers: { "x-forwarded-for": `10.1.0.${++ipN}` } }))).json()).estado;

(async () => {
  // ---- datos de prueba
  const { data: barber } = await sb.from("profiles").select("id").eq("tenant_id", tenantId).eq("role", "barber").limit(1).single();
  const { data: cli } = await sb.from("clients").insert({ name: "Cliente Terminal Prueba", phone: "+56911117777", tenant_id: tenantId }).select("id, checkin_code").single();
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
  const { data: ap } = await sb.from("appointments").insert({ client_id: cli.id, barber_id: barber.id, date: hoy, start_time: `${hoy}T18:00:00Z`, end_time: `${hoy}T18:30:00Z`, status: "scheduled", tenant_id: tenantId, deposit_amount: 5000, deposit_status: "paid" }).select("id, checkin_code").single();
  const { data: svc } = await sb.from("services").select("id").eq("tenant_id", tenantId).limit(1).single();
  await sb.from("appointment_services").insert({ appointment_id: ap.id, service_id: svc.id, price: 18000 });
  const { data: antes } = await sb.from("tenants").select("kiosk_enabled, kiosk_unlocked, kiosk_terminal_enabled").eq("id", tenantId).single();
  const { data: setAntes } = await sb.from("tenant_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  const { data: perfilAntes } = await sb.from("profiles").select("work_mode, mp_access_token, mp_device_id").eq("id", barber.id).single();
  const code = ap.checkin_code;
  const base = { appointmentId: ap.id, code };

  try {
    await sb.from("tenants").update({ kiosk_enabled: true, kiosk_unlocked: true, kiosk_terminal_enabled: false }).eq("id", tenantId);
    let r = await post(pagoTerminal, base); ok(r.status === 403, "apagado: no cobra (403)");

    await sb.from("tenants").update({ kiosk_terminal_enabled: true }).eq("id", tenantId);
    await sb.from("tenant_settings").upsert({ tenant_id: tenantId, card_payment_provider: "tuu", tuu_api_key: "FAKE", mp_access_token: null, mp_device_id: null }, { onConflict: "tenant_id" });
    await sb.from("tuu_terminals").delete().eq("tenant_id", tenantId);
    await sb.from("mp_terminals").delete().eq("tenant_id", tenantId);
    r = await post(pagoTerminal, base); ok(r.status === 400, "sin máquina conectada: avisa que falta conectarla (400)");

    // ---------- TUU
    await sb.from("tuu_terminals").insert({ tenant_id: tenantId, name: "Prueba", device_serial: "SN-TEST", terminal_type: "all", active: true });
    r = await post(pagoTerminal, { ...base, code: "ZZZZZ" }); ok(r.status === 404, "código falso: no encuentra la cita");
    r = await post(pagoTerminal, { ...base, tarjeta: "credito" }); let d = await r.json();
    ok(r.status === 200 && d.monto === 13000 && d.abono === 5000 && d.proveedor === "tuu", `TUU: cobra el saldo (18000 - abono 5000 = ${d.monto})`);
    const kpTuu = d.id;
    ok(llamadas.some((l) => l.includes("v2/Create")), "TUU: se envió el cobro a la máquina");
    r = await post(pagoTerminal, { ...base, appointmentId: ap.id }); // misma cita: reemplaza al pendiente
    d = await r.json(); ok(r.status === 200 && d.id !== kpTuu, "misma cita: se cancela el cobro anterior y se crea uno nuevo");
    const kp2 = d.id;
    ok((await sb.from("kiosk_payments").select("status").eq("id", kpTuu).single()).data.status === "cancelled", "el cobro anterior quedó cancelado");

    tuuHttp = 429; ok((await estado(kp2)) === "pending", "TUU 429 (límite de consultas): sigue esperando, NO rechaza");
    await sb.from("kiosk_payments").update({ checked_at: null }).eq("id", kp2);
    tuuHttp = 200; tuuEstado = { status: 3 }; ok((await estado(kp2)) === "pending", "TUU procesando: pendiente");
    await sb.from("kiosk_payments").update({ checked_at: null }).eq("id", kp2);
    tuuEstado = { status: "algo-raro" }; ok((await estado(kp2)) === "pending", "TUU estado desconocido: sigue esperando");
    await sb.from("kiosk_payments").update({ checked_at: null }).eq("id", kp2);
    tuuEstado = { status: 5 }; ok((await estado(kp2)) === "paid", "TUU completado: queda pagado");
    const fila = (await sb.from("kiosk_payments").select("status, paid_amount").eq("id", kp2).single()).data;
    ok(fila.status === "paid" && fila.paid_amount === 13000, "queda registrado el monto pagado (13000)");
    r = await post(pagoTerminal, base); ok(r.status === 409, "cita ya pagada: no se cobra dos veces (409)");

    // ---------- rechazo y cancelación (TUU)
    await sb.from("kiosk_payments").delete().eq("appointment_id", ap.id);
    r = await post(pagoTerminal, base); d = await r.json(); const kp3 = d.id;
    await sb.from("kiosk_payments").update({ checked_at: null }).eq("id", kp3);
    tuuEstado = { status: 4 }; ok((await estado(kp3)) === "failed", "TUU fallido: se informa como rechazado");
    r = await post(pagoTerminal, base); d = await r.json(); const kp4 = d.id;
    r = await post(pagoCancelar, { id: kp4 }); d = await r.json(); ok(d.estado === "cancelled" && d.remoto === false, "cancelar en TUU: se cancela local (TUU no permite cancelar remoto)");

    // ---------- Mercado Pago Point
    await sb.from("kiosk_payments").delete().eq("appointment_id", ap.id);
    await sb.from("tuu_terminals").delete().eq("tenant_id", tenantId);
    await sb.from("tenant_settings").upsert({ tenant_id: tenantId, card_payment_provider: "mercadopago", mp_access_token: "FAKE-MP" }, { onConflict: "tenant_id" });
    await sb.from("mp_terminals").insert({ tenant_id: tenantId, name: "Prueba", device_id: "PAX__TEST", terminal_type: "services", active: true });
    llamadas.length = 0;
    r = await post(pagoTerminal, base); d = await r.json(); const kp5 = d.id; if (r.status !== 200) console.log("  (debug MP)", r.status, JSON.stringify(d));
    ok(r.status === 200 && d.proveedor === "mercadopago" && d.monto === 13000, "MP: cobra el saldo");
    ok(llamadas.includes("MP POST orders") && llamadas.some((l) => l.endsWith("/process")), "MP: crea la orden y la procesa (despierta la máquina)");
    mpOrden = { status: "created" }; ok((await estado(kp5)) === "pending", "MP orden creada: pendiente");
    await sb.from("kiosk_payments").update({ checked_at: null }).eq("id", kp5);
    mpOrden = { status: "processed", transactions: { payments: [{ status: "approved" }] } }; ok((await estado(kp5)) === "paid", "MP aprobado: queda pagado");
    r = await post(pagoTerminal, { ...base }); ok(r.status === 409, "MP: ya pagada, no cobra otra vez");

    // ---------- máquina ocupada con otra cita
    await sb.from("kiosk_payments").delete().eq("appointment_id", ap.id);
    r = await post(pagoTerminal, base); d = await r.json();
    const { data: ap2 } = await sb.from("appointments").insert({ client_id: cli.id, barber_id: barber.id, date: hoy, start_time: `${hoy}T19:00:00Z`, end_time: `${hoy}T19:30:00Z`, status: "scheduled", tenant_id: tenantId }).select("id").single();
    await sb.from("appointment_services").insert({ appointment_id: ap2.id, service_id: svc.id, price: 10000 });
    r = await post(pagoTerminal, { appointmentId: ap2.id, code }); ok(r.status === 409, "máquina ocupada con otra cita: pide esperar (409)");
    await sb.from("kiosk_payments").delete().eq("appointment_id", ap2.id);
    await sb.from("appointment_services").delete().eq("appointment_id", ap2.id);
    await sb.from("appointments").delete().eq("id", ap2.id);

    // ---------- expirado: no se declara rechazado
    await sb.from("kiosk_payments").delete().eq("appointment_id", ap.id);
    r = await post(pagoTerminal, base); d = await r.json(); const kp6 = d.id;
    await sb.from("kiosk_payments").update({ created_at: new Date(Date.now() - 4 * 60_000).toISOString(), checked_at: null }).eq("id", kp6);
    mpOrden = { status: "created" }; ok((await estado(kp6)) === "expired", "pasados 3 min sin respuesta: 'expired' (pide avisar al equipo, no declara rechazo)");

    // ---------- máquina PERSONAL del profesional en arriendo (como Levels): se cobra en SU máquina, no en la del negocio
    await sb.from("kiosk_payments").delete().eq("appointment_id", ap.id);
    await sb.from("mp_terminals").delete().eq("tenant_id", tenantId);
    await sb.from("tenant_settings").upsert({ tenant_id: tenantId, card_payment_provider: "mercadopago", mp_access_token: null }, { onConflict: "tenant_id" });
    r = await post(pagoTerminal, base); ok(r.status === 400, "sin máquina del negocio y profesional sin la suya: pide pagar en caja (400)");
    await sb.from("profiles").update({ work_mode: "rental", mp_access_token: "TOKEN-DEL-PROFESIONAL", mp_device_id: "PAX__PERSONAL" }).eq("id", barber.id);
    llamadas.length = 0;
    r = await post(pagoTerminal, base); d = await r.json(); const kp7 = d.id;
    ok(r.status === 200 && d.proveedor === "mercadopago" && !!d.profesional, `profesional en arriendo: cobra en SU máquina (${d.profesional})`);
    const fk = (await sb.from("kiosk_payments").select("device").eq("id", kp7).single()).data;
    ok(fk.device === "PAX__PERSONAL", "el cobro queda asociado a la máquina personal (PAX__PERSONAL)");
    mpOrden = { status: "processed", transactions: { payments: [{ status: "approved" }] } };
    ok((await estado(kp7)) === "paid", "aprobado en la máquina del profesional: queda pagado");
  } finally {
    await sb.from("profiles").update(perfilAntes).eq("id", barber.id);
    await sb.from("kiosk_payments").delete().eq("appointment_id", ap.id);
    await sb.from("appointment_services").delete().eq("appointment_id", ap.id);
    await sb.from("appointments").delete().eq("id", ap.id);
    await sb.from("clients").delete().eq("id", cli.id);
    await sb.from("tuu_terminals").delete().eq("tenant_id", tenantId);
    await sb.from("mp_terminals").delete().eq("tenant_id", tenantId);
    if (setAntes) await sb.from("tenant_settings").upsert(setAntes, { onConflict: "tenant_id" }); else await sb.from("tenant_settings").delete().eq("tenant_id", tenantId);
    await sb.from("tenants").update(antes).eq("id", tenantId);
  }
  console.log(fallas ? `\n${fallas} FALLA(S)` : "\nTodo OK"); process.exit(fallas ? 1 : 0);
})();
