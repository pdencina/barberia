// Registra el pago hecho en el tótem como una VENTA NORMAL (misma tabla y mismos datos que el Punto de Venta), para que aparezca en la
// billetera del profesional, el dashboard, el cierre, la caja, los puntos y la boleta, sin que nadie la ingrese a mano.
// Es una copia acotada de /api/pos/checkout (esa ruta pide sesión del equipo y no se tocó). Es IDEMPOTENTE: un pago solo genera una venta.
import { buscarAbonosDisponibles, marcarAbonosAplicados } from "@/lib/abonos-disponibles";

export type MedioPago = "debit_card" | "credit_card" | "transfer";

// Medio de pago que se anota en la venta. Mercado Pago informa el tipo real; si no, lo elegido en el tótem; por defecto, débito.
export function medioDePago(tipoMp?: string | null, tarjeta?: string | null): MedioPago {
  const t = String(tipoMp || "").toLowerCase();
  if (t === "debit_card" || t === "prepaid_card") return "debit_card";
  if (t === "credit_card") return "credit_card";
  if (t === "account_money" || t === "bank_transfer" || t === "digital_currency" || t === "digital_wallet") return "transfer";
  if (String(tarjeta || "").toLowerCase().startsWith("cred")) return "credit_card";
  return "debit_card";
}

export type ResultadoVenta = { ok: true; transactionId: string; yaExistia?: boolean } | { ok: false; error: string };

export async function registrarVentaTotem(supabase: any, kioskPaymentId: string): Promise<ResultadoVenta> {
  // 1) Tomar el pago. Solo uno puede «reclamarlo»: si otro ya está registrando o ya terminó, no se duplica la venta.
  const colsBase = "id, tenant_id, appointment_id, amount, paid_amount, status, transaction_id, sale_status, card_type, payment_type";
  let r0: any = await supabase.from("kiosk_payments").select(`${colsBase}, tip_amount`).eq("id", kioskPaymentId).maybeSingle();
  if (r0.error) r0 = await supabase.from("kiosk_payments").select(colsBase).eq("id", kioskPaymentId).maybeSingle(); // migración 171 aún no aplicada
  const kp0 = r0.data;
  // Compras de productos (migración 172): si la columna no existe, es un pago de cita como siempre.
  if (kp0) {
    const rx: any = await supabase.from("kiosk_payments").select("kind, barber_id, client_id, items").eq("id", kioskPaymentId).maybeSingle();
    if (!rx.error && rx.data) Object.assign(kp0, rx.data);
    // Varias citas pagadas juntas (migración 174).
    const rm: any = await supabase.from("kiosk_payments").select("appointment_ids").eq("id", kioskPaymentId).maybeSingle();
    if (!rm.error && rm.data) Object.assign(kp0, rm.data);
  }
  if (!kp0) return { ok: false, error: "Pago no encontrado" };
  if (kp0.status !== "paid") return { ok: false, error: "El pago aún no está confirmado" };
  if (kp0.transaction_id) return { ok: true, transactionId: kp0.transaction_id, yaExistia: true };
  const { data: reclamado } = await supabase.from("kiosk_payments").update({ sale_status: "working" }).eq("id", kioskPaymentId).is("transaction_id", null).or("sale_status.is.null,sale_status.eq.error").select("id").maybeSingle();
  if (!reclamado) return { ok: false, error: "La venta ya se está registrando" };

  try {
    const tenantId: string = kp0.tenant_id;
    const esProducto = kp0.kind === "producto";
    let cita: any = null;
    let citaIds: string[] = [];
    let barberId: string | null;
    let clientId: string | null;
    let items: Array<{ service_id: string | null; product_id?: string | null; name: string; price: number; quantity?: number }>;
    if (esProducto) {
      // Venta de productos: el vendedor y el carrito se guardaron al crear el cobro (precios del servidor).
      // Solo consumibles (bebidas…): la venta es del estudio y no lleva profesional. Con algún cosmético sí hace falta quién vendió.
      barberId = kp0.barber_id || null;
      clientId = kp0.client_id || null;
      if (!barberId && (Array.isArray(kp0.items) ? kp0.items : []).some((i: any) => i.cosmetico)) throw new Error("Falta el profesional que vendió");
      items = (Array.isArray(kp0.items) ? kp0.items : []).map((i: any) => ({ service_id: null, product_id: i.product_id, name: i.name, price: Math.round(Number(i.price) || 0), quantity: Math.max(1, Number(i.quantity) || 1) }));
      if (items.length === 0) throw new Error("La compra no tiene productos");
    } else {
      const { data: c } = await supabase.from("appointments").select("id, client_id, barber_id, tenant_id").eq("id", kp0.appointment_id).maybeSingle();
      if (!c || c.tenant_id !== tenantId) throw new Error("Cita no encontrada");
      cita = c;
      barberId = cita.barber_id;
      clientId = cita.client_id || null;
      // Servicios de la cita (y de las otras citas pagadas juntas) con el precio guardado al reservar.
      citaIds = [cita.id, ...(Array.isArray(kp0.appointment_ids) ? kp0.appointment_ids : [])];
      const { data: filas } = await supabase.from("appointment_services").select("service_id, price, services(name)").in("appointment_id", citaIds);
      items = (filas || []).map((f: any) => ({ service_id: f.service_id, name: f.services?.name || "Servicio", price: Math.round(Number(f.price) || 0) }));
      if (items.length === 0) throw new Error("La cita no tiene servicios");
      // Productos (cosméticos) que el cliente agregó antes de pagar: van en la misma venta, con los precios guardados al crear el cobro.
      for (const p of Array.isArray(kp0.items) ? kp0.items : []) {
        items.push({ service_id: null, product_id: p.product_id, name: p.name, price: Math.round(Number(p.price) || 0), quantity: Math.max(1, Number(p.quantity) || 1) });
      }
    }

    // Totales como en el POS: total = lo cobrado por el servicio (SIN la propina); el descuento es lo que ya estaba pagado (abono) o cualquier diferencia.
    // La propina que el cliente agregó en la máquina va aparte, en tip_amount, 100% al profesional (como en el POS).
    const propina = Math.max(0, Math.round(Number(kp0.tip_amount) || 0));
    const total = Math.round(Number(kp0.amount) || 0);
    const subtotal = items.reduce((s: number, i: any) => s + i.price * (i.quantity || 1), 0);
    const discount = Math.max(0, subtotal - total);
    // Abonos ya pagados de cada cita incluida.
    const abonosUsados: Awaited<ReturnType<typeof buscarAbonosDisponibles>> = [];
    for (const cid of citaIds) {
      const disp = await buscarAbonosDisponibles(supabase, { tenantId, clientId, appointmentId: cid });
      abonosUsados.push(...disp.filter((x) => x.citaId === cid));
    }
    const abono = Math.min(discount, abonosUsados.reduce((s, x) => s + x.monto, 0));
    const medio = medioDePago(kp0.payment_type, kp0.card_type);

    const { data: barberProfile } = barberId ? await supabase.from("profiles").select("name, branch_id").eq("id", barberId).maybeSingle() : { data: null as any };
    const txRow: Record<string, any> = {
      type: "income", status: "completed", subtotal, discount, total,
      payment_method: medio, client_id: clientId, barber_id: barberId, coupon_id: null, tenant_id: tenantId,
      created_by: barberId, origin: "totem",
      ...(citaIds[0] ? { appointment_id: citaIds[0] } : {}),
      ...(barberProfile?.branch_id ? { branch_id: barberProfile.branch_id } : {}),
      ...(abono > 0 ? { prepaid_amount: abono } : {}),
      ...(propina > 0 ? { tip_amount: propina } : {}),
    };
    let { data: tx, error } = await supabase.from("transactions").insert(txRow).select().single();
    if (error && /origin|created_by|prepaid_amount|branch_id|appointment_id/i.test(error.message)) {
      const { origin: _o, created_by: _c, prepaid_amount: _p, branch_id: _b, appointment_id: _a, ...legacy } = txRow;
      ({ data: tx, error } = await supabase.from("transactions").insert(legacy).select().single());
    }
    if (error || !tx) throw new Error(error?.message || "No se pudo registrar la venta");

    // Guardar el vínculo de inmediato: si algo falla después, el pago ya no puede generar otra venta.
    await supabase.from("kiosk_payments").update({ transaction_id: tx.id }).eq("id", kioskPaymentId);

    if (abonosUsados.length && abono > 0) await marcarAbonosAplicados(supabase, abonosUsados.map((x) => x.paymentId), tx.id);

    await supabase.from("transaction_items").insert(items.map((i: any) => ({
      transaction_id: tx.id, service_id: i.service_id, product_id: i.product_id || null, description: i.name, quantity: i.quantity || 1, unit_price: i.price, total: i.price * (i.quantity || 1),
    })));

    // Productos: baja el stock y deja el movimiento, igual que el POS.
    {
      for (const i of items.filter((x: any) => x.product_id)) {
        try {
          const { data: pr } = await supabase.from("products").select("stock").eq("id", i.product_id).eq("tenant_id", tenantId).maybeSingle();
          if (pr) {
            await supabase.from("products").update({ stock: Math.max(0, Number(pr.stock) - (i.quantity || 1)) }).eq("id", i.product_id);
            await supabase.from("inventory_movements").insert({ product_id: i.product_id, type: "out_sale", quantity: i.quantity || 1, barber_id: barberId, notes: `Venta tótem - ${String(tx.id).slice(-8)}` }).then(() => {}, () => {});
          }
        } catch (e) { console.error("Tótem: error bajando stock:", e); }
      }
    }

    const { data: cli } = clientId ? await supabase.from("clients").select("name, email, loyalty_points").eq("id", clientId).maybeSingle() : { data: null as any };
    await supabase.from("audit_log").insert({
      action: "transaction_create", entity_type: "transaction", entity_id: tx.id,
      description: `Venta $${total.toLocaleString("es-CL")} — ${items.map((i: any) => i.name).join(", ")}${cli?.name ? ` — ${cli.name}` : ""} (${medio}, tótem)`,
      user_id: barberId, user_name: barberProfile?.name || "",
      metadata: { total, subtotal, discount, abono, propina, paymentMethod: medio, clientId, items: items.length, origen: "totem", kioskPaymentId },
    }).then(() => {}, () => {});

    // Puntos de fidelidad (misma regla que el POS).
    if (clientId && total > 0) {
      try {
        const { data: config } = await supabase.from("loyalty_config").select("points_per_clp").eq("active", true).eq("tenant_id", tenantId).maybeSingle();
        const ganados = Math.floor(total / (config?.points_per_clp || 1000));
        if (ganados > 0) {
          await supabase.from("loyalty_points").insert({ client_id: clientId, points: ganados, reason: "purchase", transaction_id: tx.id });
          await supabase.from("clients").update({ loyalty_points: (cli?.loyalty_points || 0) + ganados }).eq("id", clientId);
        }
      } catch (e) { console.error("Tótem: error sumando puntos:", e); }
    }

    // Boleta electrónica automática (solo si el negocio la dejó encendida) y comprobante por correo, como en el POS.
    let boleta: { folio: number; pdfUrl: string | null; pdfBase64: string | null } | null = null;
    try {
      const { emitForTransaction } = await import("@/lib/sii-emit");
      const r = await emitForTransaction(supabase, tenantId, tx.id, { onlyAuto: true, ...(barberId ? { barberId } : {}) });
      if (r.ok && r.folio) boleta = { folio: r.folio, pdfUrl: r.pdfUrl || null, pdfBase64: r.pdfBase64 || null };
    } catch (e) { console.error("Tótem: error emitiendo boleta:", e); }

    let correoEnviado = false;
    if (clientId && cli?.email) {
      try {
        const { sendReceipt } = await import("@/lib/resend");
        const { cargarEnlacesBoleta } = await import("@/lib/receipt-thanks");
        const enl = await cargarEnlacesBoleta(supabase, tenantId, tx.id);
        await sendReceipt({
          to: cli.email, clientName: cli.name || "Cliente", transactionId: tx.id,
          items: items.map((i: any) => ({ description: i.name, quantity: i.quantity || 1, unitPrice: i.price, total: i.price * (i.quantity || 1) })),
          subtotal, discount, total, paymentMethod: medio, date: new Date(), barberName: barberProfile?.name || (barberId ? "Tu profesional" : "Estudio"),
          businessLogoUrl: enl.logoUrl, businessName: enl.name,
          boletaFolio: boleta?.folio ?? null, boletaPdfUrl: boleta?.pdfUrl ?? null, boletaPdfBase64: boleta?.pdfBase64 ?? null, links: enl.links,
        });
        correoEnviado = true;
        await supabase.from("transactions").update({ receipt_sent: true, receipt_email: cli.email }).eq("id", tx.id);
      } catch (e) { console.error("Tótem: error enviando comprobante:", e); }
    }

    // Al cobrar, la cita queda completada (igual que en el POS).
    if (cita) try {
      await supabase.from("appointments").update({ status: "completed", ...(correoEnviado ? { post_service_sent: true } : {}) }).in("id", citaIds).in("status", ["scheduled", "confirmed", "in_progress"]);
    } catch (e) { console.error("Tótem: error completando la cita:", e); }

    await supabase.from("kiosk_payments").update({ sale_status: "done", sale_error: null }).eq("id", kioskPaymentId);
    return { ok: true, transactionId: tx.id };
  } catch (e: any) {
    const error = String(e?.message || e).slice(0, 300);
    await supabase.from("kiosk_payments").update({ sale_status: "error", sale_error: error }).eq("id", kioskPaymentId).is("transaction_id", null);
    console.error("Tótem: no se pudo registrar la venta:", error);
    return { ok: false, error };
  }
}
