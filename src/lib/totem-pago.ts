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
// Es idempotente: si ya estaba pagado devuelve false y no avisa de nuevo. Opción A: NO crea la venta; el equipo la registra en el POS.
export async function confirmarPagoTotem(
  supabase: any,
  kp: { id: string; tenant_id: string; appointment_id: string },
  montoPagado: number,
  referencia: string,
  medio: string, // ej. "por Mercado Pago" / "con tarjeta en la máquina"
): Promise<boolean> {
  const { notify } = await import("@/lib/notify");
  const { primerNombre } = await import("@/lib/totem");
  const { data: marcado } = await supabase.from("kiosk_payments")
    .update({ status: "paid", mp_payment_id: referencia, paid_amount: Math.round(montoPagado) || 0, paid_at: new Date().toISOString() })
    .eq("id", kp.id).neq("status", "paid").select("id").maybeSingle();
  if (!marcado) return false;

  const { data: a } = await supabase.from("appointments").select("barber_id, client:clients(name)").eq("id", kp.appointment_id).maybeSingle();
  const nombre = primerNombre((a as any)?.client?.name) || "Un cliente";
  const monto = Math.round(montoPagado).toLocaleString("es-CL");
  await notify({
    tenantId: kp.tenant_id, kind: "kiosk_payment", roles: ["admin"], userIds: a?.barber_id ? [a.barber_id] : [], professionalId: a?.barber_id || null,
    title: "Pago recibido desde el tótem",
    body: `${nombre} pagó $${monto} ${medio} desde el tótem. Regístralo en el POS.`,
    url: "/dashboard/pos",
  }).catch(() => {});
  await supabase.from("audit_log").insert({
    action: "kiosk_payment_paid", entity_type: "appointment", entity_id: kp.appointment_id,
    description: `Pago desde el tótem: $${monto} ${medio} (${referencia})`, metadata: { kioskPaymentId: kp.id, referencia, tenantId: kp.tenant_id },
  }).then(() => {}, () => {});
  return true;
}
