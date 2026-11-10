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
