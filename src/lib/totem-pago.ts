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
  kp: { id: string; tenant_id: string; appointment_id: string },
  montoPagado: number,
  referencia: string,
  medio: string, // ej. "por Mercado Pago" / "con tarjeta en la máquina"
  tipoPagoMp?: string | null, // tipo real informado por Mercado Pago (debit_card, credit_card, account_money...)
): Promise<boolean> {
  const { notify } = await import("@/lib/notify");
  const { primerNombre } = await import("@/lib/totem");
  const { registrarVentaTotem } = await import("@/lib/totem-venta");
  const { data: marcado } = await supabase.from("kiosk_payments")
    .update({ status: "paid", mp_payment_id: referencia, paid_amount: Math.round(montoPagado) || 0, paid_at: new Date().toISOString(), ...(tipoPagoMp ? { payment_type: String(tipoPagoMp).slice(0, 40) } : {}) })
    .eq("id", kp.id).neq("status", "paid").select("id").maybeSingle();
  if (!marcado) return false;

  // Registrar la venta (si el negocio no la apagó). La columna puede no existir aún: en ese caso se registra igual.
  let venta: "registrada" | "error" | "apagada" = "apagada";
  const { data: neg } = await supabase.from("tenants").select("kiosk_auto_sale").eq("id", kp.tenant_id).maybeSingle();
  if ((neg as any)?.kiosk_auto_sale !== false) {
    const r = await registrarVentaTotem(supabase, kp.id);
    venta = r.ok ? "registrada" : "error";
  }

  const { data: a } = await supabase.from("appointments").select("barber_id, client:clients(name)").eq("id", kp.appointment_id).maybeSingle();
  const nombre = primerNombre((a as any)?.client?.name) || "Un cliente";
  const monto = Math.round(montoPagado).toLocaleString("es-CL");
  await notify({
    tenantId: kp.tenant_id, kind: "kiosk_payment", roles: ["admin"], userIds: a?.barber_id ? [a.barber_id] : [], professionalId: a?.barber_id || null,
    title: venta === "error" ? "Pago recibido: falta registrar la venta" : "Pago recibido desde el tótem",
    body: venta === "registrada"
      ? `${nombre} pagó $${monto} ${medio} desde el tótem. La venta ya quedó registrada.`
      : venta === "error"
        ? `${nombre} pagó $${monto} ${medio} desde el tótem, pero la venta NO se pudo registrar sola. Regístrala en el POS.`
        : `${nombre} pagó $${monto} ${medio} desde el tótem. Regístralo en el POS.`,
    url: venta === "registrada" ? "/dashboard/caja" : "/dashboard/pos",
  }).catch(() => {});
  await supabase.from("audit_log").insert({
    action: "kiosk_payment_paid", entity_type: "appointment", entity_id: kp.appointment_id,
    description: `Pago desde el tótem: $${monto} ${medio} (${referencia})`, metadata: { kioskPaymentId: kp.id, referencia, tenantId: kp.tenant_id },
  }).then(() => {}, () => {});
  return true;
}
