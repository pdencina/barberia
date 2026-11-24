// Prueba: dos personas con fichas distintas pagan JUNTAS en un solo cobro, y cada una queda con su propia venta. Base de PRUEBAS; limpia lo que crea.
//   npx tsx scripts/test-kiosk-dos-clientes.ts <tenantId>
import "./_solo-con-base";
import { citasParaCobro, citasDeOtrasPersonas } from "../src/lib/totem-citas";
import { confirmarPagoTotem } from "../src/lib/totem-pago";
import { repartirCobro } from "../src/lib/totem-venta";

const [tenantId] = process.argv.slice(2);
const { createAdminSupabase } = require("../src/lib/supabase/server");
const sb = createAdminSupabase();
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

(async () => {
  // reparto puro
  const r = repartirCobro([27000, 10000], 27000, 3000);
  ok(r[0].total === 17000 && r[1].total === 10000 && r[0].propina + r[1].propina === 3000, "reparto: 27.000 cobrados = 17.000 + 10.000 y la propina de 3.000 se reparte sin perder un peso");

  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
  const { data: barbers } = await sb.from("profiles").select("id").eq("tenant_id", tenantId).eq("role", "barber").limit(2);
  const { data: svc } = await sb.from("services").select("id").eq("tenant_id", tenantId).limit(1).single();
  const { data: c1 } = await sb.from("clients").insert({ name: "Cliente Uno Enzo", phone: "+56911117071", tenant_id: tenantId }).select("id").single();
  const { data: c2 } = await sb.from("clients").insert({ name: "Cliente Dos Enzo", phone: "+56911117072", tenant_id: tenantId }).select("id").single();
  const aps: string[] = []; const kps: string[] = []; const txs: string[] = [];
  const cita = async (cliente: string, barber: string, hora: string, precio: number) => {
    const { data: ap } = await sb.from("appointments").insert({ client_id: cliente, barber_id: barber, date: hoy, start_time: `${hoy}T${hora}:00Z`, end_time: `${hoy}T${hora}:30Z`, status: "scheduled", tenant_id: tenantId }).select("id, checkin_code").single();
    aps.push(ap.id);
    await sb.from("appointment_services").insert({ appointment_id: ap.id, service_id: svc.id, price: precio });
    return ap;
  };
  try {
    const a1 = await cita(c1.id, barbers[0].id, "20:00", 17000);
    const a2 = await cita(c2.id, barbers[0].id, "20:30", 10000);
    const p = await citasParaCobro(sb, tenantId, a1.checkin_code, [a1.id]);
    ok(p.ok, "cliente principal válido");
    if (!p.ok) throw new Error("sin principal");
    const o = await citasDeOtrasPersonas(sb, tenantId, p, [{ code: a2.checkin_code, appointmentIds: [a2.id] }]);
    ok(o.ok && o.saldo === 10000 && o.extraIds[0] === a2.id, "la otra persona (otro código) suma $10.000 y entra al cobro");
    const malo = await citasDeOtrasPersonas(sb, tenantId, p, [{ code: "ZZZZZ", appointmentIds: [a2.id] }]);
    ok(!malo.ok, "un código ajeno no se puede sumar");
    const dup = await citasDeOtrasPersonas(sb, tenantId, p, [{ code: a1.checkin_code, appointmentIds: [a1.id] }]);
    ok(!dup.ok, "la misma cita no se puede sumar dos veces");
    if (barbers[1]) {
      const a3 = await cita(c2.id, barbers[1].id, "21:00", 5000);
      const otroPro = await citasDeOtrasPersonas(sb, tenantId, p, [{ code: a3.checkin_code, appointmentIds: [a3.id] }]);
      ok(!otroPro.ok, "citas de otro profesional no se pagan juntas");
    }

    // pago compartido de $27.000 (+ $2.000 de propina en la máquina) -> dos ventas separadas
    const { data: kp } = await sb.from("kiosk_payments").insert({ tenant_id: tenantId, appointment_id: a1.id, appointment_ids: [a2.id], amount: 27000, method: "terminal", provider: "mercadopago" }).select("id").single();
    kps.push(kp.id);
    await sb.from("tenants").update({ kiosk_auto_sale: true }).eq("id", tenantId);
    await confirmarPagoTotem(sb, { id: kp.id, tenant_id: tenantId, appointment_id: a1.id }, 29000, "ref-dos-clientes", "con tarjeta en la máquina", "debit_card", { propina: 2000, detalle: { prueba: true } });
    const { data: ventas } = await sb.from("transactions").select("id, client_id, total, tip_amount, barber_id").eq("tenant_id", tenantId).eq("origin", "totem").in("client_id", [c1.id, c2.id]);
    (ventas || []).forEach((v: any) => txs.push(v.id));
    const v1 = (ventas || []).find((v: any) => v.client_id === c1.id);
    const v2 = (ventas || []).find((v: any) => v.client_id === c2.id);
    ok((ventas || []).length === 2, "quedan 2 ventas separadas");
    ok(Number(v1?.total) === 17000 && Number(v2?.total) === 10000, "cada cliente con lo suyo: $17.000 y $10.000");
    ok(Number(v1?.tip_amount || 0) + Number(v2?.tip_amount || 0) === 2000 && v1?.barber_id === barbers[0].id && v2?.barber_id === barbers[0].id, "la propina de $2.000 se reparte entre las dos y ambas quedan a nombre del profesional");
    const { data: estados } = await sb.from("appointments").select("status").in("id", [a1.id, a2.id]);
    ok(estados.every((e: any) => e.status === "completed"), "las dos citas quedan completadas");
    const { count } = await sb.from("kiosk_payments").select("id", { count: "exact", head: true }).eq("id", kp.id);
    ok(count === 1, "fue un solo cobro");
  } finally {
    for (const id of kps) await sb.from("kiosk_payments").delete().eq("id", id);
    for (const id of txs) {
      await sb.from("loyalty_points").delete().eq("transaction_id", id);
      await sb.from("transaction_items").delete().eq("transaction_id", id);
      await sb.from("transactions").delete().eq("id", id);
    }
    for (const ap of aps) { await sb.from("appointment_services").delete().eq("appointment_id", ap); await sb.from("appointments").delete().eq("id", ap); }
    await sb.from("clients").delete().in("id", [c1.id, c2.id]);
  }
  console.log(fallas ? `\n${fallas} FALLA(S)` : "\nTodo OK"); process.exit(fallas ? 1 : 0);
})();
