// Prueba: una cita completada SIN cobro se puede pagar en el tótem; una ya cobrada no. Base de PRUEBAS; limpia lo que crea.
//   npx tsx scripts/test-kiosk-sin-cobro.ts <tenantId>
import "./_solo-con-base";
import { citasParaCobro } from "../src/lib/totem-citas";

const [tenantId] = process.argv.slice(2);
const { createAdminSupabase } = require("../src/lib/supabase/server");
const sb = createAdminSupabase();
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

(async () => {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
  const { data: barber } = await sb.from("profiles").select("id").eq("tenant_id", tenantId).eq("role", "barber").limit(1).single();
  const { data: svc } = await sb.from("services").select("id").eq("tenant_id", tenantId).limit(1).single();
  const { data: cli } = await sb.from("clients").insert({ name: "Cliente Sin Cobro", phone: "+56911117070", tenant_id: tenantId }).select("id").single();
  const aps: string[] = []; const txs: string[] = [];
  const CODE = "ZZQ77";
  const cita = async (hora: string) => {
    const { data: ap, error } = await sb.from("appointments").insert({ client_id: cli.id, barber_id: barber.id, date: hoy, start_time: `${hoy}T${hora}:00Z`, end_time: `${hoy}T${hora}:30Z`, status: "completed", tenant_id: tenantId, checkin_code: CODE }).select("id, checkin_code").single();
    if (error) throw error;
    await sb.from("appointments").update({ checkin_code: CODE }).eq("id", ap.id);
    aps.push(ap.id);
    await sb.from("appointment_services").insert({ appointment_id: ap.id, service_id: svc.id, price: 12000 });
    return ap.id as string;
  };
  const venta = async (appointmentId: string | null, serviceId: string | null) => {
    const { data: tx, error } = await sb.from("transactions").insert({ type: "income", status: "completed", subtotal: 12000, discount: 0, total: 12000, payment_method: "cash", client_id: cli.id, barber_id: barber.id, tenant_id: tenantId, ...(appointmentId ? { appointment_id: appointmentId } : {}) }).select("id").single();
    if (error) throw error;
    txs.push(tx.id);
    await sb.from("transaction_items").insert({ transaction_id: tx.id, service_id: serviceId, description: "x", quantity: 1, unit_price: 12000, total: 12000 });
    return tx.id as string;
  };
  const borrarVenta = async (id: string) => { await sb.from("loyalty_points").delete().eq("transaction_id", id); await sb.from("transaction_items").delete().eq("transaction_id", id); await sb.from("transactions").delete().eq("id", id); };
  try {
    const a = await cita("15:00");
    const libre = await citasParaCobro(sb, tenantId, CODE, [a]);
    ok(libre.ok && (libre as any).saldo === 12000, "completada sin cobro: se puede pagar");
    const bebida = await venta(null, null);
    ok((await citasParaCobro(sb, tenantId, CODE, [a])).ok, "haber comprado solo un producto no la da por pagada");
    await borrarVenta(bebida);
    const suelta = await venta(null, svc.id);
    ok(!(await citasParaCobro(sb, tenantId, CODE, [a])).ok, "venta de servicio del día sin unir a la cita: no se cobra de nuevo");
    await borrarVenta(suelta);
    await venta(a, svc.id);
    const pagada = await citasParaCobro(sb, tenantId, CODE, [a]);
    ok(!pagada.ok && (pagada as any).status === 409, "cobrada en el POS: no se cobra de nuevo");
  } finally {
    for (const t of txs) await borrarVenta(t);
    for (const ap of aps) { await sb.from("appointment_services").delete().eq("appointment_id", ap); await sb.from("appointments").delete().eq("id", ap); }
    await sb.from("clients").delete().eq("id", cli.id);
  }
  console.log(fallas ? `\n${fallas} FALLA(S)` : "\nTodo OK"); process.exit(fallas ? 1 : 0);
})();
