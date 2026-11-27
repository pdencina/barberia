// Venta real de punta a punta en el tótem con un cupón de «solo efectivo o transferencia». Llama a las MISMAS rutas que usa el
// tótem. Solo base de PRUEBAS; deja todo como estaba y borra lo que crea.   npx tsx scripts/test-kiosk-cupon.ts <tenantId>
import "./_solo-con-base";
import { readFileSync } from "fs";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes("ucwrdmwtlesayjxmlbve")) { console.log("ABORTADO: esta prueba solo corre contra la base de pruebas"); process.exit(1); }
delete process.env.RESEND_API_KEY; // sin correos

const tenantId = process.argv[2];
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

(async () => {
  const { NextRequest } = require("next/server");
  const { createAdminSupabase } = require("../src/lib/supabase/server");
  const { resolverEfectivo } = require("../src/lib/totem-efectivo");
  const sb = createAdminSupabase();
  const ruta = (n: string) => require(`../src/app/api/totem/${n}/route`).POST;
  const pedir = async (n: string, body: any) => {
    const r = await ruta(n)(new NextRequest(`http://localhost/api/totem/${n}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` } }));
    return { status: r.status, d: await r.json() };
  };

  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
  const cols = "kiosk_code, kiosk_enabled, kiosk_unlocked, kiosk_cash_enabled, kiosk_terminal_enabled, kiosk_pay_qr_enabled, kiosk_auto_sale";
  const { data: antes } = await sb.from("tenants").select(cols).eq("id", tenantId).single();
  const codigo = antes.kiosk_code || "PRUEBAK";
  const flags = { kiosk_code: codigo, kiosk_enabled: true, kiosk_unlocked: true, kiosk_cash_enabled: true, kiosk_terminal_enabled: true, kiosk_pay_qr_enabled: true, kiosk_auto_sale: true };
  await sb.from("tenants").update(flags).eq("id", tenantId);

  const { data: barbers } = await sb.from("profiles").select("id").eq("tenant_id", tenantId).eq("role", "barber").limit(2);
  const yo = barbers[0].id;
  const { data: svc } = await sb.from("services").select("id").eq("tenant_id", tenantId).limit(1).single();
  const { data: cupon, error: ec } = await sb.from("coupons").insert({ code: `PRUEBA-TOTEM-${Date.now() % 100000}`, discount_type: "percentage", discount_value: 20, active: true, tenant_id: tenantId, conditions: { profesionalIds: [yo], pagos: ["cash", "transfer"] } }).select("id, code").single();
  if (ec) throw ec;
  const { data: cli } = await sb.from("clients").insert({ name: "Cliente Promo", phone: "+56911119090", tenant_id: tenantId }).select("id, checkin_code").single();
  const citas: string[] = [];
  const crearCita = async (hora: string, conCupon: boolean) => {
    const { data: a, error } = await sb.from("appointments").insert({ client_id: cli.id, barber_id: yo, date: hoy, start_time: `${hoy}T${hora}:00Z`, end_time: `${hoy}T${hora}:30Z`, status: "scheduled", tenant_id: tenantId, coupon_id: conCupon ? cupon.id : null }).select("id, checkin_code").single();
    if (error) throw error;
    citas.push(a.id);
    await sb.from("appointment_services").insert({ appointment_id: a.id, service_id: svc.id, price: 17000 });
    return a;
  };

  try {
    const a = await crearCita("12:00", true);
    const code = a.checkin_code;
    const busca = await pedir("buscar", { codigo, code });
    const vista = (busca.d.citas || []).find((c: any) => c.id === a.id);
    ok(busca.status === 200 && !!vista, "1. el tótem encuentra la cita con el código del cliente");
    ok(vista?.saldo === 13600, `2. muestra el monto con descuento: $${vista?.saldo} (esperado $13.600)`);
    const debito = await pedir("pago-terminal", { codigo, code, appointmentId: a.id, tarjeta: "debito" });
    ok(debito.status === 409 && /efectivo/.test(debito.d.error || ""), `3. débito bloqueado: ${debito.d.error}`);
    const credito = await pedir("pago-terminal", { codigo, code, appointmentId: a.id, tarjeta: "credito" });
    ok(credito.status === 409, "4. crédito bloqueado");
    const qr = await pedir("pago-qr", { codigo, code, appointmentId: a.id });
    ok(qr.status === 409, "5. QR bloqueado");
    const { count: cobros } = await sb.from("kiosk_payments").select("id", { count: "exact", head: true }).eq("appointment_id", a.id);
    ok(!cobros, "6. los intentos bloqueados no dejan ningún cobro creado");
    const efe = await pedir("pago-efectivo", { codigo, code, appointmentId: a.id });
    ok(efe.status === 200 && efe.d.monto === 13600, `7. pedido en efectivo por $${efe.d.monto} ${efe.d.error || ""}`);
    const si = await resolverEfectivo(sb, { tenantId, id: efe.d.id, coincide: true, userId: yo, soloBarberId: yo });
    ok(si.ok && si.registrada, `8. el profesional confirma y la venta se registra ${si.ok ? "" : si.error}`);
    const { data: tx } = await sb.from("transactions").select("id, total, subtotal, discount, payment_method, coupon_id, appointment_id, status").eq("client_id", cli.id);
    const v = tx?.[0];
    ok(tx?.length === 1 && Number(v.total) === 13600 && Number(v.discount) === 3400 && Number(v.subtotal) === 17000, `9. venta: subtotal ${v?.subtotal}, descuento ${v?.discount}, total ${v?.total}`);
    ok(v?.payment_method === "cash" && v?.coupon_id === cupon.id && v?.appointment_id === a.id && v?.status === "completed", "10. en efectivo, con el cupón anotado y enlazada a la cita");
    const { data: cita } = await sb.from("appointments").select("status").eq("id", a.id).single();
    ok(cita.status === "completed", "11. la cita queda completada");
    const { data: cu } = await sb.from("coupons").select("used_count").eq("id", cupon.id).single();
    ok(cu.used_count === 1, `12. el cupón cuenta 1 uso (${cu.used_count})`);
    await resolverEfectivo(sb, { tenantId, id: efe.d.id, coincide: true, userId: yo });
    const otra = await pedir("pago-efectivo", { codigo, code, appointmentId: a.id });
    const { count: ventas } = await sb.from("transactions").select("id", { count: "exact", head: true }).eq("client_id", cli.id);
    ok(ventas === 1 && otra.status !== 200, `13. no se puede cobrar dos veces (${otra.d.error})`);
    // código escrito en el tótem (sin guiones) sobre una cita que no lo traía
    const m = await crearCita("20:00", false);
    const escribir = (extra: any) => pedir("cupon", { codigo, code: m.checkin_code, appointmentIds: [m.id], cupon: cupon.code.replace(/-/g, "").toLowerCase(), ...extra });
    const mal = await escribir({ cupon: "NOEXISTE" });
    ok(mal.status === 404, `16. código inventado: ${mal.d.error}`);
    const ajeno = await pedir("cupon", { codigo, code: "ZZZZZ", appointmentIds: [m.id], cupon: cupon.code });
    ok(ajeno.status === 404, "17. no se aplica a una cita ajena");
    const puesto = await escribir({});
    ok(puesto.status === 200 && puesto.d.descuento === 3400, `18. código escrito en el tótem descuenta $${puesto.d.descuento} ${puesto.d.error || ""}`);
    const ver = ((await pedir("buscar", { codigo, code: m.checkin_code, modo: "pagar" })).d.citas || []).find((c: any) => c.id === m.id);
    ok(ver?.saldo === 13600 && ver?.promo?.pagos?.join() === "cash,transfer", `19. la pantalla recibe monto nuevo y medios permitidos`);
    const t2 = await pedir("pago-terminal", { codigo, code: m.checkin_code, appointmentId: m.id, tarjeta: "debito" });
    ok(t2.status === 409, "20. con el código puesto, tarjeta bloqueada");
    await escribir({ quitar: true });
    const { data: sinC } = await sb.from("appointments").select("coupon_id").eq("id", m.id).single();
    ok(sinC.coupon_id === null, "21. se puede quitar");
    await sb.from("coupons").update({ conditions: { personas: 2 } }).eq("id", cupon.id);
    const dos = await escribir({});
    ok(dos.status === 409 && /2 personas/.test(dos.d.error), "22. promo de 2 personas no se puede poner suelta");
    await sb.from("coupons").update({ conditions: { servicioIds: ["33333333-3333-3333-3333-333333333333"] } }).eq("id", cupon.id);
    const serv = await escribir({});
    ok(serv.status === 409 && /servicio/.test(serv.d.error), "23. servicio que no entra: no se aplica");
    await sb.from("coupons").update({ conditions: { profesionalIds: [yo], pagos: ["cash", "transfer"] } }).eq("id", cupon.id);
    const sin = await crearCita("16:00", false);
    const normal = await pedir("pago-terminal", { codigo, code: sin.checkin_code, appointmentId: sin.id, tarjeta: "debito" });
    ok(!/promoción/.test(normal.d.error || ""), `14. una cita SIN cupón no queda bloqueada para tarjeta (${normal.d.error || "cobro creado"})`);
    // con el efectivo apagado en el local, el mensaje no manda a un botón que no existe
    await sb.from("tenants").update({ kiosk_cash_enabled: false }).eq("id", tenantId);
    const b = await crearCita("18:00", true);
    const apagado = await pedir("pago-terminal", { codigo, code: b.checkin_code, appointmentId: b.id, tarjeta: "debito" });
    ok(apagado.status === 409 && /caja/i.test(apagado.d.error || ""), `15. sin efectivo en el tótem manda a caja: ${apagado.d.error}`);
  } finally {
    const { data: tx } = await sb.from("transactions").select("id").eq("client_id", cli.id);
    for (const t of tx || []) {
      await sb.from("kiosk_payments").update({ transaction_id: null }).eq("transaction_id", t.id);
      await sb.from("loyalty_points").delete().eq("transaction_id", t.id);
      await sb.from("transaction_items").delete().eq("transaction_id", t.id);
      await sb.from("transaction_payments").delete().eq("transaction_id", t.id);
      await sb.from("transactions").delete().eq("id", t.id);
    }
    if (citas.length) {
      await sb.from("kiosk_payments").delete().in("appointment_id", citas);
      await sb.from("appointment_services").delete().in("appointment_id", citas);
      await sb.from("appointments").delete().in("id", citas);
    }
    await sb.from("loyalty_points").delete().eq("client_id", cli.id);
    await sb.from("clients").delete().eq("id", cli.id);
    await sb.from("coupons").delete().eq("id", cupon.id);
    await sb.from("tenants").update(antes).eq("id", tenantId);
  }
  console.log(fallas ? `\n${fallas} FALLAS` : "\nTODO OK: venta completa en el tótem con cupón");
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error("ERROR", e?.message || e); process.exit(1); });
