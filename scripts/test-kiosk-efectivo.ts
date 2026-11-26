// Prueba del pago en EFECTIVO desde el tótem: nada se registra hasta que el equipo confirma. Base de PRUEBAS; limpia lo que crea.
//   npx tsx scripts/test-kiosk-efectivo.ts <tenantId>
import "./_solo-con-base";
import { efectivoPendiente, resolverEfectivo } from "../src/lib/totem-efectivo";

const [tenantId] = process.argv.slice(2);
const { createAdminSupabase } = require("../src/lib/supabase/server");
const sb = createAdminSupabase();
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

(async () => {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
  const { data: barbers } = await sb.from("profiles").select("id").eq("tenant_id", tenantId).eq("role", "barber").limit(2);
  const yo = barbers[0].id, otro = barbers[1]?.id || "00000000-0000-0000-0000-000000000000";
  const { data: svc } = await sb.from("services").select("id").eq("tenant_id", tenantId).limit(1).single();
  const { data: cli } = await sb.from("clients").insert({ name: "Cliente Efectivo", phone: "+56911118080", tenant_id: tenantId }).select("id").single();
  const { data: antes } = await sb.from("tenants").select("kiosk_auto_sale").eq("id", tenantId).single();
  await sb.from("tenants").update({ kiosk_auto_sale: true }).eq("id", tenantId);
  const aps: string[] = []; const kps: string[] = [];
  const pedido = async (hora: string) => {
    const { data: ap } = await sb.from("appointments").insert({ client_id: cli.id, barber_id: yo, date: hoy, start_time: `${hoy}T${hora}:00Z`, end_time: `${hoy}T${hora}:30Z`, status: "scheduled", tenant_id: tenantId }).select("id").single();
    aps.push(ap.id);
    await sb.from("appointment_services").insert({ appointment_id: ap.id, service_id: svc.id, price: 12000 });
    const { data: kp } = await sb.from("kiosk_payments").insert({ tenant_id: tenantId, appointment_id: ap.id, amount: 12000, method: "cash" }).select("id").single();
    kps.push(kp.id);
    return { ap: ap.id as string, kp: kp.id as string };
  };
  try {
    const a = await pedido("17:00");
    const mios = await efectivoPendiente(sb, tenantId, yo);
    ok(mios.some((p) => p.id === a.kp && p.monto === 12000 && p.personas[0]?.cliente === "Cliente Efectivo"), "el profesional ve su pedido en efectivo con monto y cliente");
    ok(!(await efectivoPendiente(sb, tenantId, otro)).some((p) => p.id === a.kp), "otro profesional no lo ve");
    const { count: sinVenta } = await sb.from("transactions").select("id", { count: "exact", head: true }).eq("client_id", cli.id);
    ok((sinVenta || 0) === 0, "antes de confirmar no hay ninguna venta");
    const ajeno = await resolverEfectivo(sb, { tenantId, id: a.kp, coincide: true, userId: otro, soloBarberId: otro });
    ok(!ajeno.ok && (ajeno as any).status === 403, "otro profesional no puede confirmarlo");
    const si = await resolverEfectivo(sb, { tenantId, id: a.kp, coincide: true, userId: yo, soloBarberId: yo });
    const { data: tx } = await sb.from("transactions").select("total, payment_method, barber_id").eq("client_id", cli.id);
    ok(si.ok && tx.length === 1 && tx[0].payment_method === "cash" && Number(tx[0].total) === 12000 && tx[0].barber_id === yo, "«Sí, coincide»: una venta en efectivo de $12.000 a nombre del profesional");
    const { data: cita } = await sb.from("appointments").select("status").eq("id", a.ap).single();
    ok(cita.status === "completed", "la cita queda completada");
    const rep = await resolverEfectivo(sb, { tenantId, id: a.kp, coincide: true, userId: yo });
    const { count: c1 } = await sb.from("transactions").select("id", { count: "exact", head: true }).eq("client_id", cli.id);
    ok(!rep.ok && c1 === 1, "confirmar dos veces no duplica la venta");

    const b = await pedido("18:00");
    const no = await resolverEfectivo(sb, { tenantId, id: b.kp, coincide: false, userId: yo, soloBarberId: yo });
    const { data: kpb } = await sb.from("kiosk_payments").select("status, transaction_id").eq("id", b.kp).single();
    const { count: c2 } = await sb.from("transactions").select("id", { count: "exact", head: true }).eq("client_id", cli.id);
    ok(no.ok && kpb.status === "failed" && !kpb.transaction_id && c2 === 1, "«No coincide»: no se registra venta y el pedido queda rechazado");

    const c = await pedido("19:00");
    const { data: otroPago } = await sb.from("kiosk_payments").insert({ tenant_id: tenantId, appointment_id: c.ap, amount: 12000, method: "terminal", status: "paid" }).select("id").single();
    kps.push(otroPago.id);
    const doble = await resolverEfectivo(sb, { tenantId, id: c.kp, coincide: true, userId: yo });
    ok(!doble.ok && (doble as any).status === 409, "si la cita ya se pagó con tarjeta, el efectivo no se registra");
  } finally {
    const { data: txs } = await sb.from("transactions").select("id").eq("client_id", cli.id);
    for (const id of kps) await sb.from("kiosk_payments").delete().eq("id", id);
    for (const t of txs || []) {
      await sb.from("loyalty_points").delete().eq("transaction_id", t.id);
      await sb.from("transaction_items").delete().eq("transaction_id", t.id);
      await sb.from("transactions").delete().eq("id", t.id);
    }
    for (const ap of aps) { await sb.from("appointment_services").delete().eq("appointment_id", ap); await sb.from("appointments").delete().eq("id", ap); }
    await sb.from("clients").delete().eq("id", cli.id);
    await sb.from("tenants").update({ kiosk_auto_sale: antes.kiosk_auto_sale }).eq("id", tenantId);
  }
  console.log(fallas ? `\n${fallas} FALLA(S)` : "\nTodo OK"); process.exit(fallas ? 1 : 0);
})();
