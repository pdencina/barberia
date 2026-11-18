// Prueba de pagar VARIAS citas del mismo cliente juntas desde el tótem. Usa la base de PRUEBAS y limpia lo que crea.
//   npx tsx scripts/test-kiosk-varias-citas.ts <tenantId>
import "./_solo-con-base";
import { citasParaCobro } from "../src/lib/totem-citas";
import { confirmarPagoTotem } from "../src/lib/totem-pago";

const [tenantId] = process.argv.slice(2);
const { createAdminSupabase } = require("../src/lib/supabase/server");
const sb = createAdminSupabase();
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

(async () => {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
  const { data: barbers } = await sb.from("profiles").select("id").eq("tenant_id", tenantId).eq("role", "barber").limit(2);
  const { data: cli } = await sb.from("clients").insert({ name: "Cliente Dos Citas", phone: "+56911114040", tenant_id: tenantId }).select("id, checkin_code").single();
  const { data: svcs } = await sb.from("services").select("id").eq("tenant_id", tenantId).limit(2);
  const aps: string[] = []; const kps: string[] = [];
  const cita = async (barber: string, hora: string, precio: number) => {
    const { data: ap } = await sb.from("appointments").insert({ client_id: cli.id, barber_id: barber, date: hoy, start_time: `${hoy}T${hora}:00Z`, end_time: `${hoy}T${hora}:30Z`, status: "scheduled", tenant_id: tenantId }).select("id, checkin_code").single();
    aps.push(ap.id);
    await sb.from("appointment_services").insert({ appointment_id: ap.id, service_id: svcs[0].id, price: precio });
    return ap;
  };
  try {
    const a1 = await cita(barbers[0].id, "18:00", 10000);
    const a2 = await cita(barbers[0].id, "18:30", 7000);
    const code = a1.checkin_code;
    const c1 = await citasParaCobro(sb, tenantId, code, [a1.id, a2.id]);
    ok(c1.ok && c1.saldo === 17000 && c1.extraIds.length === 1, "dos citas del mismo profesional: suma $17.000 en el servidor");
    const c2 = await citasParaCobro(sb, tenantId, "ZZZZZ", [a1.id, a2.id]);
    ok(!c2.ok, "con un código ajeno se rechaza");
    if (barbers[1]) {
      const a3 = await cita(barbers[1].id, "19:00", 5000);
      const c3 = await citasParaCobro(sb, tenantId, code, [a1.id, a3.id]);
      ok(!c3.ok, "citas con profesionales distintos no se pagan juntas");
    }
    // pagar juntas -> una venta con los servicios de ambas, ambas citas completadas
    const { data: kp } = await sb.from("kiosk_payments").insert({ tenant_id: tenantId, appointment_id: a1.id, appointment_ids: [a2.id], amount: 17000, method: "terminal", provider: "mercadopago" }).select("id").single();
    kps.push(kp.id);
    await sb.from("tenants").update({ kiosk_auto_sale: true }).eq("id", tenantId);
    await confirmarPagoTotem(sb, { id: kp.id, tenant_id: tenantId, appointment_id: a1.id }, 17000, "ref-2citas", "con tarjeta en la máquina", "debit_card");
    const { data: fila } = await sb.from("kiosk_payments").select("transaction_id").eq("id", kp.id).single();
    const { data: tx } = await sb.from("transactions").select("total, subtotal, barber_id").eq("id", fila.transaction_id).single();
    const { data: items } = await sb.from("transaction_items").select("total").eq("transaction_id", fila.transaction_id);
    ok(Number(tx.total) === 17000 && Number(tx.subtotal) === 17000 && items.length === 2, "una sola venta de $17.000 con los 2 servicios");
    const { data: estados } = await sb.from("appointments").select("status").in("id", [a1.id, a2.id]);
    ok(estados.every((e: any) => e.status === "completed"), "las dos citas quedan completadas");
    const c4 = await citasParaCobro(sb, tenantId, code, [a2.id]);
    ok(!c4.ok && c4.status === 409, "la segunda cita ya no se puede cobrar otra vez");
  } finally {
    for (const id of kps) {
      const { data } = await sb.from("kiosk_payments").select("transaction_id").eq("id", id).single();
      await sb.from("kiosk_payments").delete().eq("id", id);
      if (data?.transaction_id) {
        await sb.from("loyalty_points").delete().eq("transaction_id", data.transaction_id);
        await sb.from("transaction_items").delete().eq("transaction_id", data.transaction_id);
        await sb.from("transactions").delete().eq("id", data.transaction_id);
      }
    }
    for (const ap of aps) { await sb.from("appointment_services").delete().eq("appointment_id", ap); await sb.from("appointments").delete().eq("id", ap); }
    await sb.from("clients").delete().eq("id", cli.id);
  }
  console.log(fallas ? `\n${fallas} FALLA(S)` : "\nTodo OK"); process.exit(fallas ? 1 : 0);
})();
