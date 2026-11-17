// Pago por QR del totem (opcion A: solo avisa y marca; la venta la registra el equipo en el POS).

// Lo que falta por pagar de una cita, calculado SIEMPRE en el servidor: precios guardados al reservar menos el abono ya pagado.
export async function saldoCita(supabase: any, appointmentId: string): Promise<{ total: number; abono: number; saldo: number } | null> {
  const { data: a } = await supabase.from("appointments").select("id, deposit_amount, deposit_status").eq("id", appointmentId).maybeSingle();
  if (!a) return null;
  const { data: items } = await supabase.from("appointment_services").select("price").eq("appointment_id", appointmentId);
  const total = Math.round((items || []).reduce((s: number, i: any) => s + (Number(i.price) || 0), 0));
  const abono = a.deposit_status === "paid" ? Math.max(0, Math.round(Number(a.deposit_amount) || 0)) : 0;
  return { total, abono, saldo: Math.max(0, total - abono) };
}

// Marca un cobro del totem como PAGADO (solo si seguia sin pagar), avisa al profesional y a administración y deja constancia.
// Es idempotente: si ya estaba pagado devuelve false y no avisa de nuevo. Además registra la VENTA automáticamente (como una venta normal del POS)
// salvo que el negocio haya apagado «Registrar la venta automáticamente»; si la venta no se pudo registrar, se avisa para hacerlo a mano.
export async function confirmarPagoTotem(
  supabase: any,
  kp: { id: string; tenant_id: string; appointment_id: string | null; kind?: string | null; barber_id?: string | null; client_id?: string | null },
  montoPagado: number,
  referencia: string,
  medio: string, // ej. "por Mercado Pago" / "con tarjeta en la máquina"
  tipoPagoMp?: string | null, // tipo real informado por Mercado Pago (debit_card, credit_card, account_money...)
  extra?: { propina?: number; detalle?: any }, // propina que el cliente agregó en la máquina y lo que informó el proveedor (para revisarlo)
): Promise<boolean> {
  const { notify } = await import("@/lib/notify");
  const { primerNombre } = await import("@/lib/totem");
  const { registrarVentaTotem } = await import("@/lib/totem-venta");
  const { data: marcado } = await supabase.from("kiosk_payments")
    .update({ status: "paid", mp_payment_id: referencia, paid_amount: Math.round(montoPagado) || 0, paid_at: new Date().toISOString(), ...(tipoPagoMp ? { payment_type: String(tipoPagoMp).slice(0, 40) } : {}) })
    .eq("id", kp.id).neq("status", "paid").select("id").maybeSingle();
  if (!marcado) return false;
  // Propina y detalle del proveedor (migración 171). Si las columnas aún no existen, no se frena nada.
  if (extra && ((extra.propina || 0) > 0 || extra.detalle)) {
    await supabase.from("kiosk_payments").update({ tip_amount: Math.max(0, Math.round(extra.propina || 0)), provider_detail: extra.detalle ?? null }).eq("id", kp.id).then(() => {}, () => {});
  }

  // Registrar la venta (si el negocio no la apagó). La columna puede no existir aún: en ese caso se registra igual.
  let venta: "registrada" | "error" | "apagada" = "apagada";
  const { data: neg } = await supabase.from("tenants").select("kiosk_auto_sale").eq("id", kp.tenant_id).maybeSingle();
  if ((neg as any)?.kiosk_auto_sale !== false) {
    const r = await registrarVentaTotem(supabase, kp.id);
    venta = r.ok ? "registrada" : "error";
  }

  let a: any = null;
  if (kp.appointment_id) ({ data: a } = await supabase.from("appointments").select("barber_id, client:clients(name)").eq("id", kp.appointment_id).maybeSingle());
  else if (kp.barber_id) {
    const { data: cl } = kp.client_id ? await supabase.from("clients").select("name").eq("id", kp.client_id).maybeSingle() : { data: null as any };
    a = { barber_id: kp.barber_id, client: cl };
  }
  const queCompro = kp.kind === "producto" ? "productos " : "";
  const nombre = primerNombre((a as any)?.client?.name) || "Un cliente";
  const propinaN = Math.max(0, Math.round(extra?.propina || 0));
  // Si hubo propina, el total pagado la incluye: se muestra el servicio y la propina por separado.
  const monto = Math.round(montoPagado - propinaN).toLocaleString("es-CL") + (propinaN > 0 ? ` + $${propinaN.toLocaleString("es-CL")} de propina` : "");
  await notify({
    tenantId: kp.tenant_id, kind: "kiosk_payment", roles: ["admin"], userIds: a?.barber_id ? [a.barber_id] : [], professionalId: a?.barber_id || null,
    title: venta === "error" ? "Pago recibido: falta registrar la venta" : kp.kind === "producto" ? "Venta de productos desde el tótem" : "Pago recibido desde el tótem",
    body: venta === "registrada"
      ? `${nombre} pagó ${queCompro}$${monto} ${medio} desde el tótem. La venta ya quedó registrada.`
      : venta === "error"
        ? `${nombre} pagó ${queCompro}$${monto} ${medio} desde el tótem, pero la venta NO se pudo registrar sola. Regístrala en el POS.`
        : `${nombre} pagó ${queCompro}$${monto} ${medio} desde el tótem. Regístralo en el POS.`,
    url: venta === "registrada" ? "/dashboard/caja" : "/dashboard/pos",
  }).catch(() => {});
  await supabase.from("audit_log").insert({
    action: "kiosk_payment_paid", entity_type: kp.appointment_id ? "appointment" : "kiosk_payment", entity_id: kp.appointment_id || kp.id,
    description: `Pago desde el tótem: $${monto} ${medio} (${referencia})`, metadata: { kioskPaymentId: kp.id, referencia, tenantId: kp.tenant_id },
  }).then(() => {}, () => {});
  return true;
}
