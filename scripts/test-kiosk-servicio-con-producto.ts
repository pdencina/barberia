// Prueba: pagar un servicio junto con un producto cosmético agregado en el tótem (una sola venta, stock rebajado). Base de PRUEBAS; limpia lo que crea.
//   npx tsx scripts/test-kiosk-servicio-con-producto.ts <tenantId>
import "./_solo-con-base";
import { armarItemsProductos } from "../src/lib/totem-producto";
import { confirmarPagoTotem } from "../src/lib/totem-pago";

const [tenantId] = process.argv.slice(2);
const { createAdminSupabase } = require("../src/lib/supabase/server");
const sb = createAdminSupabase();
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

(async () => {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
  const { data: barber } = await sb.from("profiles").select("id").eq("tenant_id", tenantId).eq("role", "barber").limit(1).single();
  const { data: svc } = await sb.from("services").select("id").eq("tenant_id", tenantId).limit(1).single();
  const { data: cli } = await sb.from("clients").insert({ name: "Cliente Servicio y Producto", phone: "+56911116060", tenant_id: tenantId }).select("id").single();
  const { data: cosm } = await sb.from("products").insert({ tenant_id: tenantId, name: "Cera Prueba", price: 6000, stock: 4, active: true, product_type: "sale", category: "Cosméticos" }).select("id").single();
  const { data: beb } = await sb.from("products").insert({ tenant_id: tenantId, name: "Bebida Prueba", price: 1500, stock: 4, active: true, product_type: "sale", category: "Bebidas" }).select("id").single();
  const { data: ap } = await sb.from("appointments").insert({ client_id: cli.id, barber_id: barber.id, date: hoy, start_time: `${hoy}T22:00:00Z`, end_time: `${hoy}T22:30:00Z`, status: "scheduled", tenant_id: tenantId }).select("id").single();
  await sb.from("appointment_services").insert({ appointment_id: ap.id, service_id: svc.id, price: 10000 });
  let kpId: string | null = null;
  try {
    const bad = await armarItemsProductos(sb, tenantId, [{ id: beb.id, cantidad: 1 }], true);
    ok(!bad.ok, "al servicio solo se le pueden agregar cosméticos (una bebida se rechaza)");
    const buena = await armarItemsProductos(sb, tenantId, [{ id: cosm.id, cantidad: 2 }], true);
    ok(buena.ok && buena.total === 12000, "cosmético: total con el precio del servidor ($12.000 por 2)");
    if (!buena.ok) throw new Error("sin carrito");

    const { data: kp } = await sb.from("kiosk_payments").insert({ tenant_id: tenantId, appointment_id: ap.id, items: buena.items, amount: 22000, method: "terminal", provider: "mercadopago" }).select("id").single();
    kpId = kp.id;
    await sb.from("tenants").update({ kiosk_auto_sale: true }).eq("id", tenantId);
    await confirmarPagoTotem(sb, { id: kp.id, tenant_id: tenantId, appointment_id: ap.id }, 22000, "ref-svc-prod", "con tarjeta en la máquina", "debit_card");
    const { data: fila } = await sb.from("kiosk_payments").select("transaction_id").eq("id", kp.id).single();
    const { data: tx } = await sb.from("transactions").select("total, subtotal, discount, barber_id").eq("id", fila.transaction_id).single();
    const { data: items } = await sb.from("transaction_items").select("service_id, product_id, quantity, total").eq("transaction_id", fila.transaction_id);
    ok(Number(tx.total) === 22000 && Number(tx.subtotal) === 22000 && Number(tx.discount) === 0 && tx.barber_id === barber.id, "una sola venta de $22.000 a nombre del profesional, sin descuento");
    ok(items.length === 2 && items.some((i: any) => i.service_id) && items.some((i: any) => i.product_id === cosm.id && Number(i.quantity) === 2), "la venta trae el servicio y el producto (cantidad 2)");
    const { data: pr } = await sb.from("products").select("stock").eq("id", cosm.id).single();
    ok(Number(pr.stock) === 2, `stock del producto rebajado de 4 a 2 (queda ${pr.stock})`);
  } finally {
    if (kpId) {
      const { data } = await sb.from("kiosk_payments").select("transaction_id").eq("id", kpId).single();
      await sb.from("kiosk_payments").delete().eq("id", kpId);
      if (data?.transaction_id) {
        await sb.from("loyalty_points").delete().eq("transaction_id", data.transaction_id);
        await sb.from("transaction_items").delete().eq("transaction_id", data.transaction_id);
        await sb.from("transactions").delete().eq("id", data.transaction_id);
      }
    }
    await sb.from("inventory_movements").delete().in("product_id", [cosm.id, beb.id]);
    await sb.from("products").delete().in("id", [cosm.id, beb.id]);
    await sb.from("appointment_services").delete().eq("appointment_id", ap.id);
    await sb.from("appointments").delete().eq("id", ap.id);
    await sb.from("clients").delete().eq("id", cli.id);
  }
  console.log(fallas ? `\n${fallas} FALLA(S)` : "\nTodo OK"); process.exit(fallas ? 1 : 0);
})();
