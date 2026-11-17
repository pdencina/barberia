// Prueba de que un pago del tótem se registra como VENTA normal (una sola vez). Usa la base de PRUEBAS y limpia lo que crea.
//   npx tsx scripts/test-kiosk-venta.ts <tenantId>
import "./_solo-con-base"; // se salta en CI (necesita la base de pruebas)
import { registrarVentaTotem, medioDePago } from "../src/lib/totem-venta";
import { confirmarPagoTotem } from "../src/lib/totem-pago";

const [tenantId] = process.argv.slice(2);
const { createAdminSupabase } = require("../src/lib/supabase/server");
const sb = createAdminSupabase();
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

(async () => {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
  const { data: barber } = await sb.from("profiles").select("id").eq("tenant_id", tenantId).eq("role", "barber").limit(1).single();
  const { data: cli } = await sb.from("clients").insert({ name: "Cliente Venta Prueba", phone: "+56911113030", tenant_id: tenantId }).select("id").single();
  const { data: svcs } = await sb.from("services").select("id, name").eq("tenant_id", tenantId).limit(2);
  const { data: antes } = await sb.from("tenants").select("kiosk_auto_sale").eq("id", tenantId).single();
  const creados: { kp: string[]; ap: string[] } = { kp: [], ap: [] };

  const nuevaCita = async (precios: number[]) => {
    const { data: ap } = await sb.from("appointments").insert({ client_id: cli.id, barber_id: barber.id, date: hoy, start_time: `${hoy}T18:00:00Z`, end_time: `${hoy}T18:30:00Z`, status: "scheduled", tenant_id: tenantId }).select("id").single();
    creados.ap.push(ap.id);
    for (let i = 0; i < precios.length; i++) await sb.from("appointment_services").insert({ appointment_id: ap.id, service_id: svcs[i % svcs.length].id, price: precios[i] });
    return ap.id as string;
  };
  const nuevoPago = async (apId: string, extra: Record<string, any> = {}) => {
    const { data: kp } = await sb.from("kiosk_payments").insert({ tenant_id: tenantId, appointment_id: apId, amount: 15000, method: "terminal", provider: "mercadopago", ...extra }).select("id").single();
    creados.kp.push(kp.id);
    return kp.id as string;
  };
  const ventas = async (kpId: string) => { const { data } = await sb.from("kiosk_payments").select("transaction_id").eq("id", kpId).single(); return data.transaction_id as string | null; };

  try {
    // ---- mapeo del medio de pago
    ok(medioDePago("debit_card") === "debit_card" && medioDePago("credit_card") === "credit_card" && medioDePago("account_money") === "transfer", "medio de pago: tipo de Mercado Pago -> débito / crédito / transferencia");
    ok(medioDePago(null, "credito") === "credit_card" && medioDePago(null, "debito") === "debit_card" && medioDePago() === "debit_card", "medio de pago: sin dato de MP usa lo elegido en el tótem; por defecto débito");

    // ---- 1) pago aprobado -> venta completa
    const ap1 = await nuevaCita([15000, 5000]);
    const kp1 = await nuevoPago(ap1, { status: "paid", paid_amount: 15000, paid_at: new Date().toISOString(), card_type: "credito" });
    const r1 = await registrarVentaTotem(sb, kp1);
    ok(r1.ok === true, "registra la venta de un pago aprobado");
    const txId = await ventas(kp1);
    const { data: tx } = await sb.from("transactions").select("*").eq("id", txId).single();
    ok(!!tx && tx.type === "income" && tx.status === "completed" && Number(tx.total) === 15000 && Number(tx.subtotal) === 20000 && Number(tx.discount) === 5000, `totales como el POS: subtotal ${tx?.subtotal}, descuento ${tx?.discount}, total ${tx?.total}`);
    ok(tx?.payment_method === "credit_card" && tx?.barber_id === barber.id && tx?.client_id === cli.id && tx?.tenant_id === tenantId, "medio crédito, profesional de la cita, cliente y negocio correctos");
    ok(tx?.origin === "totem" && tx?.created_by === barber.id, "origen «totem» y emitida por el profesional");
    const { data: items } = await sb.from("transaction_items").select("total, service_id").eq("transaction_id", txId);
    ok(items?.length === 2 && items.reduce((s: number, i: any) => s + Number(i.total), 0) === 20000, "los 2 servicios de la cita quedan como ítems de la venta");
    const { data: citaDespues } = await sb.from("appointments").select("status").eq("id", ap1).single();
    ok(citaDespues.status === "completed", "la cita queda completada, como al cobrar en el POS");
    const { data: kpFila } = await sb.from("kiosk_payments").select("sale_status").eq("id", kp1).single();
    ok(kpFila.sale_status === "done", "el pago queda marcado con la venta registrada");

    // ---- 2) idempotencia
    const r2 = await registrarVentaTotem(sb, kp1);
    const { count: cuenta } = await sb.from("transactions").select("id", { count: "exact", head: true }).eq("id", txId);
    ok(r2.ok === true && (r2 as any).yaExistia === true && cuenta === 1, "segundo intento: no crea otra venta");

    // ---- 3) llamadas simultáneas -> una sola venta
    const ap3 = await nuevaCita([15000]);
    const kp3 = await nuevoPago(ap3, { status: "paid", paid_amount: 15000, paid_at: new Date().toISOString() });
    await Promise.all([registrarVentaTotem(sb, kp3), registrarVentaTotem(sb, kp3), registrarVentaTotem(sb, kp3)]);
    const { count: c3 } = await sb.from("transactions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("client_id", cli.id).eq("origin", "totem").eq("total", 15000);
    ok((c3 || 0) === 2, `3 llamadas a la vez para el mismo pago: una sola venta (ventas del tótem de prueba = ${c3}, esperadas 2 con la del paso 1)`);

    // ---- 4) confirmar un pago (como lo hace el aviso de la máquina/QR): marca pagado + registra venta, y no se repite
    await sb.from("tenants").update({ kiosk_auto_sale: true }).eq("id", tenantId);
    const ap4 = await nuevaCita([15000]);
    const kp4 = await nuevoPago(ap4);
    const kp4row = { id: kp4, tenant_id: tenantId, appointment_id: ap4 };
    const c4a = await confirmarPagoTotem(sb, kp4row, 15000, "ref-test-4", "por Mercado Pago", "debit_card");
    const t4 = await ventas(kp4);
    const { data: tx4 } = t4 ? await sb.from("transactions").select("payment_method, total").eq("id", t4).single() : { data: null as any };
    ok(c4a === true && !!t4 && tx4?.payment_method === "debit_card" && Number(tx4?.total) === 15000, "confirmar pago de Mercado Pago (débito): queda pagado y con su venta");
    const c4b = await confirmarPagoTotem(sb, kp4row, 15000, "ref-test-4", "por Mercado Pago", "debit_card");
    ok(c4b === false && (await ventas(kp4)) === t4, "aviso repetido: no se duplica la venta");

    // ---- 5) negocio con «registrar la venta automáticamente» apagado: solo marca pagado
    await sb.from("tenants").update({ kiosk_auto_sale: false }).eq("id", tenantId);
    const ap5 = await nuevaCita([15000]);
    const kp5 = await nuevoPago(ap5);
    await confirmarPagoTotem(sb, { id: kp5, tenant_id: tenantId, appointment_id: ap5 }, 15000, "ref-test-5", "con tarjeta en la máquina");
    const { data: k5 } = await sb.from("kiosk_payments").select("status, transaction_id").eq("id", kp5).single();
    ok(k5.status === "paid" && !k5.transaction_id, "con la opción apagada: queda pagado pero NO crea venta (la registra el equipo)");

    // ---- 6) pago no confirmado: no se registra
    const ap6 = await nuevaCita([15000]);
    const kp6 = await nuevoPago(ap6);
    const r6 = await registrarVentaTotem(sb, kp6);
    ok(r6.ok === false, "un pago pendiente nunca genera venta");
  } finally {
    for (const kpId of creados.kp) {
      const { data } = await sb.from("kiosk_payments").select("transaction_id").eq("id", kpId).single();
      await sb.from("kiosk_payments").delete().eq("id", kpId);
      if (data?.transaction_id) {
        await sb.from("loyalty_points").delete().eq("transaction_id", data.transaction_id);
        await sb.from("transaction_items").delete().eq("transaction_id", data.transaction_id);
        await sb.from("transactions").delete().eq("id", data.transaction_id);
      }
    }
    for (const ap of creados.ap) { await sb.from("appointment_services").delete().eq("appointment_id", ap); await sb.from("appointments").delete().eq("id", ap); }
    await sb.from("clients").delete().eq("id", cli.id);
    await sb.from("tenants").update({ kiosk_auto_sale: antes.kiosk_auto_sale }).eq("id", tenantId);
  }
  console.log(fallas ? `\n${fallas} FALLA(S)` : "\nTodo OK"); process.exit(fallas ? 1 : 0);
})();
