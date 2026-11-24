// Prueba de la compra de PRODUCTOS en el tótem: carrito validado en el servidor, vendedor por código o elegido, venta con stock. Usa la base de PRUEBAS y limpia.
//   npx tsx scripts/test-kiosk-producto.ts <tenantId>
import "./_solo-con-base";
import { armarCompraProductos } from "../src/lib/totem-producto";
import { registrarVentaTotem } from "../src/lib/totem-venta";
import { confirmarPagoTotem } from "../src/lib/totem-pago";

const [tenantId] = process.argv.slice(2);
const { createAdminSupabase } = require("../src/lib/supabase/server");
const sb = createAdminSupabase();
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

(async () => {
  const { data: barber } = await sb.from("profiles").select("id").eq("tenant_id", tenantId).eq("role", "barber").limit(1).single();
  const { data: prod } = await sb.from("products").insert({ tenant_id: tenantId, name: "Producto Prueba Tótem", price: 4000, stock: 5, active: true, product_type: "sale", category: "Cosméticos" }).select("id").single();
  const kps: string[] = [];
  try {
    // carrito: precio y stock salen del servidor
    const c1 = await armarCompraProductos(sb, tenantId, { productos: [{ id: prod.id, cantidad: 2, price: 1 }], barberId: barber.id });
    ok(c1.ok && c1.total === 8000 && c1.vendedor?.id === barber.id, "carrito: total con el precio del servidor (el precio del navegador se ignora) y vendedor elegido");
    const c2 = await armarCompraProductos(sb, tenantId, { productos: [{ id: prod.id, cantidad: 9 }], barberId: barber.id });
    ok(!c2.ok, "carrito: más unidades que el stock se rechaza");
    const c3 = await armarCompraProductos(sb, tenantId, { productos: [{ id: prod.id, cantidad: 1 }] });
    ok(!c3.ok && (c3 as any).pedirProfesional === true, "sin código ni profesional: pide elegir quién te atendió");
    const c4 = await armarCompraProductos(sb, tenantId, { productos: [{ id: prod.id, cantidad: 1 }], code: "ZZZZZ" });
    ok(!c4.ok && (c4 as any).pedirProfesional === true, "código sin cita hoy: pide elegir quién te atendió");
    const c5 = await armarCompraProductos(sb, tenantId, { productos: [{ id: prod.id, cantidad: 1 }], barberId: "00000000-0000-0000-0000-000000000000" });
    ok(!c5.ok, "profesional inexistente se rechaza");

    // consumibles (no cosméticos): son del estudio, no piden profesional
    const { data: beb } = await sb.from("products").insert({ tenant_id: tenantId, name: "Bebida Prueba Tótem", price: 1500, stock: 5, active: true, product_type: "sale", category: "Bebidas" }).select("id").single();
    try {
      const cb = await armarCompraProductos(sb, tenantId, { productos: [{ id: beb.id, cantidad: 2 }] });
      ok(cb.ok && cb.vendedor === null && cb.total === 3000, "bebidas: no piden profesional (compra del estudio)");
      const { data: kpb } = await sb.from("kiosk_payments").insert({ tenant_id: tenantId, kind: "producto", items: [{ product_id: beb.id, name: "Bebida Prueba Tótem", price: 1500, quantity: 2, cosmetico: false }], amount: 3000, method: "terminal", provider: "mercadopago" }).select("id").single();
      kps.push(kpb.id);
      await sb.from("tenants").update({ kiosk_auto_sale: true }).eq("id", tenantId);
      await confirmarPagoTotem(sb, { id: kpb.id, tenant_id: tenantId, appointment_id: null, kind: "producto", barber_id: null, client_id: null }, 3000, "ref-beb", "con tarjeta en la máquina", "debit_card");
      const { data: fb } = await sb.from("kiosk_payments").select("transaction_id").eq("id", kpb.id).single();
      const { data: txb } = fb?.transaction_id ? await sb.from("transactions").select("total, barber_id, created_by").eq("id", fb.transaction_id).single() : { data: null as any };
      ok(!!txb && Number(txb.total) === 3000 && txb.barber_id === null, "venta de bebidas registrada del estudio, sin profesional");
    } finally { await sb.from("products").delete().eq("id", beb.id); }

    // pago aprobado -> venta con ítems de producto, stock rebajado, a nombre del vendedor, una sola vez
    const { data: kp } = await sb.from("kiosk_payments").insert({ tenant_id: tenantId, kind: "producto", barber_id: barber.id, items: [{ product_id: prod.id, name: "Producto Prueba Tótem", price: 4000, quantity: 2 }], amount: 8000, method: "terminal", provider: "mercadopago" }).select("id").single();
    kps.push(kp.id);
    await sb.from("tenants").update({ kiosk_auto_sale: true }).eq("id", tenantId);
    const conf = await confirmarPagoTotem(sb, { id: kp.id, tenant_id: tenantId, appointment_id: null, kind: "producto", barber_id: barber.id, client_id: null }, 8000, "ref-prod-1", "con tarjeta en la máquina", "debit_card");
    const { data: fila } = await sb.from("kiosk_payments").select("transaction_id").eq("id", kp.id).single();
    const { data: tx } = await sb.from("transactions").select("*").eq("id", fila.transaction_id).single();
    ok(conf === true && !!tx && Number(tx.total) === 8000 && tx.barber_id === barber.id && tx.origin === "totem", "venta registrada a nombre del vendedor, total $8.000, origen tótem");
    const { data: it } = await sb.from("transaction_items").select("product_id, quantity, total").eq("transaction_id", tx.id);
    ok(it?.length === 1 && it[0].product_id === prod.id && Number(it[0].quantity) === 2 && Number(it[0].total) === 8000, "ítem de producto con cantidad 2");
    const { data: pr } = await sb.from("products").select("stock").eq("id", prod.id).single();
    ok(Number(pr.stock) === 3, `stock rebajado de 5 a 3 (queda ${pr.stock})`);
    const r2 = await registrarVentaTotem(sb, kp.id);
    const { data: pr2 } = await sb.from("products").select("stock").eq("id", prod.id).single();
    ok(r2.ok && (r2 as any).yaExistia === true && Number(pr2.stock) === 3, "segundo intento: no duplica la venta ni rebaja el stock otra vez");
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
    await sb.from("inventory_movements").delete().eq("product_id", prod.id);
    await sb.from("products").delete().eq("id", prod.id);
  }
  console.log(fallas ? `\n${fallas} FALLA(S)` : "\nTodo OK"); process.exit(fallas ? 1 : 0);
})();
