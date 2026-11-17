import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, demasiadosIntentos, ipDe } from "@/lib/totem";
import { confirmarPagoTotem } from "@/lib/totem-pago";
import { resolverTerminal, consultarCobroDetalle } from "@/lib/totem-terminal";

// GET ?codigo=&id=: el tótem pregunta si el pago ya se confirmó.
//  - QR: lo confirma el aviso de Mercado Pago (webhook); aquí solo se lee el estado.
//  - Máquina: aquí se consulta a Mercado Pago/TUU (como mucho cada 4 s, TUU limita las consultas) y, si se aprobó, se confirma.
export async function GET(req: NextRequest) {
  if (demasiadosIntentos(`pagoest:${ipDe(req)}`, 120)) return NextResponse.json({ error: "Muchos intentos" }, { status: 429 });
  const supabase = createAdminSupabase();
  const sp = new URL(req.url).searchParams;
  const t = await negocioDelTotem(supabase, sp.get("codigo"));
  const id = sp.get("id") || "";
  if (!t || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ estado: "desconocido" }, { status: 404 });

  const cols = "id, tenant_id, appointment_id, amount, status, method, provider, external_id, created_at, checked_at";
  let rk: any = await supabase.from("kiosk_payments").select(`${cols}, kind, barber_id, client_id`).eq("id", id).eq("tenant_id", t.id).maybeSingle();
  if (rk.error) rk = await supabase.from("kiosk_payments").select(cols).eq("id", id).eq("tenant_id", t.id).maybeSingle(); // migración 172 aún no aplicada
  const kp: any = rk.data;
  if (!kp) return NextResponse.json({ estado: "desconocido" }, { headers: { "Cache-Control": "no-store" } });

  if (kp.method === "terminal" && kp.status === "pending" && kp.external_id) {
    const edad = Date.now() - new Date(kp.created_at).getTime();
    const desdeUltima = kp.checked_at ? Date.now() - new Date(kp.checked_at).getTime() : Infinity;
    if (desdeUltima >= 4000) {
      await supabase.from("kiosk_payments").update({ checked_at: new Date().toISOString() }).eq("id", kp.id);
      // La máquina es la del profesional de la cita (si tiene la suya) o la del negocio, igual que al crear el cobro.
      let barberDeMaquina: string | null = kp.barber_id || null;
      if (!barberDeMaquina && kp.appointment_id) { const { data: ap } = await supabase.from("appointments").select("barber_id").eq("id", kp.appointment_id).maybeSingle(); barberDeMaquina = (ap as any)?.barber_id || null; }
      const term = await resolverTerminal(supabase, t.id, barberDeMaquina);
      const det: { estado: "approved" | "rejected" | "cancelled" | "pending"; tipoPago?: string | null; montos?: any } = term ? await consultarCobroDetalle(term, kp.external_id) : { estado: "pending" };
      const est = det.estado;
      if (est === "approved") {
        // El pago se registra solo como venta (billetera, dashboard, cierre...). El tipo de tarjeta lo informa Mercado Pago; en TUU es el elegido en el tótem.
        // Lo realmente pagado puede ser MÁS que lo cobrado: la diferencia es la propina que el cliente agregó en la máquina.
        const pagado = Number(det.montos?.pagado) > 0 ? Number(det.montos.pagado) : Number(kp.amount);
        await confirmarPagoTotem(supabase, kp, pagado, `${kp.provider}:${kp.external_id}`, "con tarjeta en la máquina", det.tipoPago || null, { propina: det.montos?.propina || 0, detalle: det.montos?.detalle });
        return NextResponse.json({ estado: "paid" }, { headers: { "Cache-Control": "no-store" } });
      }
      if (est === "rejected" || est === "cancelled") {
        await supabase.from("kiosk_payments").update({ status: est === "rejected" ? "failed" : "cancelled" }).eq("id", kp.id).eq("status", "pending");
        return NextResponse.json({ estado: est === "rejected" ? "failed" : "cancelled" }, { headers: { "Cache-Control": "no-store" } });
      }
    }
    // Pasados 3 minutos sin respuesta se deja de esperar. NO se declara rechazado: puede que sí se haya cobrado, así que el tótem pide avisar al equipo.
    if (edad > 3 * 60_000) return NextResponse.json({ estado: "expired" }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ estado: kp.status }, { headers: { "Cache-Control": "no-store" } });
}
