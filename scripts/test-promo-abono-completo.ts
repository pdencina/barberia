// Reserva con abono y cupón de punta a punta con las rutas reales y Mercado Pago simulado. Solo base de PRUEBAS.
// No borra datos: al terminar anula la cita de prueba, desactiva el cupón y restaura la configuración del abono.
//   npx tsx scripts/test-promo-abono-completo.ts <tenantId>
import "./_solo-con-base";
import { readFileSync } from "fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes("ucwrdmwtlesayjxmlbve")) { console.log("ABORTADO: solo contra la base de pruebas"); process.exit(1); }
delete process.env.RESEND_API_KEY; delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const T = process.argv[2];
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };
let referencia = "", volver = "", monto = 0;
const real = global.fetch;
global.fetch = (async (u: any, o: any) => {
  const url = String(u?.url || u);
  if (url.includes("api.mercadopago.com/checkout/preferences")) { const b = JSON.parse(o.body); referencia = b.external_reference; volver = b.back_urls.failure; monto = b.items[0].unit_price; return new Response(JSON.stringify({ id: "pref", init_point: "https://mp.example/pagar" }), { status: 201 }); }
  if (url.includes("api.mercadopago.com/v1/payments/")) return new Response(JSON.stringify({ status: "approved", external_reference: referencia, transaction_amount: monto }), { status: 200 });
  return real(u, o);
}) as any;

(async () => {
  const { NextRequest } = require("next/server");
  const sb = require("../src/lib/supabase/server").createAdminSupabase();
  const { firmarNegocio } = require("../src/lib/deposit");
  const { saldoCita } = require("../src/lib/totem-pago");
  const ped = (ruta: string, body: any, q = "") => new NextRequest(`http://localhost/api/${ruta}${q}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  const { data: previo, error: ep } = await sb.from("tenant_settings").select("deposit_enabled, deposit_mode, deposit_fixed_amount, mp_access_token").eq("tenant_id", T).maybeSingle();
  if (ep) throw ep;
  if (!previo) { const { error } = await sb.from("tenant_settings").insert({ tenant_id: T }); if (error) throw error; }
  const antes = previo || { deposit_enabled: false, deposit_mode: "percent", deposit_fixed_amount: null, mp_access_token: null };
  await sb.from("tenant_settings").update({ deposit_enabled: true, deposit_mode: "fixed", deposit_fixed_amount: 10000, mp_access_token: antes.mp_access_token || "PRUEBA-SIN-VALOR" }).eq("tenant_id", T);
  const { data: bs } = await sb.from("profiles").select("id").eq("tenant_id", T).eq("role", "barber").eq("active", true).order("name").limit(1);
  const B = bs[0].id;
  const { data: svc } = await sb.from("services").select("id").eq("tenant_id", T).eq("active", true).order("price", { ascending: false }).limit(1).single();
  const { resolverServicios } = require("../src/lib/booking-services");
  const precio = (await resolverServicios(sb, B, T, [svc.id])).total;
  let fecha = "", hora = "";
  for (let i = 1; i <= 10 && !hora; i++) {
    const d = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
    const r = await require("../src/app/api/public/availability/route").GET(new NextRequest(`http://localhost/api/public/availability?barberId=${B}&date=${d}&duration=90`));
    const s = (await r.json()).slots || []; if (s.length) { fecha = d; hora = s[0]; }
  }
  const codigo = `PRUEBA-ABONO-${Date.now() % 100000}`;
  const { data: cupon } = await sb.from("coupons").insert({ code: codigo, discount_type: "fixed_amount", discount_value: 5000, active: true, tenant_id: T }).select("id").single();
  let cita: string | null = null;
  try {
    const crear = require("../src/app/api/booking/create-deposit/route").POST;
    const base = { barberId: B, serviceIds: [svc.id], date: fecha, startTime: hora, clientName: "Zeta Abono", clientEmail: "zeta.abono@example.com", clientPhone: "900000033" };
    const malo = await crear(ped("booking/create-deposit", { ...base, couponCode: "NOEXISTE" }));
    ok(malo.status === 400, "1. código inventado: avisa antes de cobrar");
    const r = await crear(ped("booking/create-deposit", { ...base, couponCode: codigo, marketingConsent: true }));
    const d = await r.json();
    ok(r.status === 200 && monto === Math.min(10000, precio - 5000), `2. abono de siempre: $${monto} (servicio $${precio}) ${d.error || ""}`);
    ok(volver.includes(`c=${codigo}`), "3. si no paga, vuelve al link de la promoción");
    const aviso = require("../src/app/api/webhooks/deposit/route").POST;
    const pago = String(Date.now());
    await aviso(ped("webhooks/deposit", { type: "payment", data: { id: pago } }, `?t=${T}&s=${firmarNegocio(T)}`));
    const { data: a } = await sb.from("appointments").select("id, coupon_id, deposit_amount, deposit_status").eq("deposit_payment_id", pago).maybeSingle();
    cita = a?.id || null;
    ok(!!a && a.coupon_id === cupon.id && a.deposit_status === "paid", "4. al pagarse, la cita queda con el cupón y el abono");
    const s = a ? await saldoCita(sb, a.id) : null;
    ok(!!s && s.descuento === 5000 && s.saldo === precio - 5000 - monto, `5. en el local paga $${s?.saldo}`);
    const v = await require("../src/app/api/booking/deposit-verify/route").GET(new NextRequest(`http://localhost/api/booking/deposit-verify?ref=${referencia}&payment_id=${pago}`));
    const vd = await v.json();
    ok(vd.estado === "pagado" && vd.resumen?.saldo === precio - 5000 - monto && vd.resumen?.codigo === codigo, "6. la pantalla de vuelta muestra la cuenta");
  } finally {
    if (cita) await sb.from("appointments").update({ status: "cancelled" }).eq("id", cita);
    await sb.from("coupons").update({ active: false }).eq("id", cupon.id);
    await sb.from("tenant_settings").update(antes).eq("tenant_id", T);
  }
  console.log(fallas ? `\n${fallas} FALLAS` : "\nTODO OK: reserva con abono y cupón");
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error("ERROR", e?.message || e); process.exit(1); });
