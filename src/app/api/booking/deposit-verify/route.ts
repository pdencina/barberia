import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { cargarCredencialAbono } from "@/lib/deposit";
import { HOLD_SEGUNDOS } from "@/lib/deposit-hold";
import { resumenAbono } from "@/lib/resumen-abono";
import { decidirEstadoAbono } from "@/lib/verificar-abono";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Las pantallas de vuelta de Mercado Pago preguntan aqui si la reserva REALMENTE quedo pagada (publico a proposito: la referencia es un UUID
// imposible de adivinar y solo se devuelve un estado y un texto, ningun dato personal). Nunca se da por buena la direccion de vuelta.
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const ref = q.get("ref") || "";
  const paymentId = (q.get("payment_id") || q.get("collection_id") || "").replace(/\D/g, "").slice(0, 20);
  if (!UUID.test(ref)) return NextResponse.json({ estado: "desconocido" });
  const supabase = createAdminSupabase();

  const { data: intent } = await supabase.from("booking_intents").select("data, created_at, tenant_id").eq("ref", ref).maybeSingle();
  let deposito: { status: string; appointment_id: string | null } | null = null;
  let pagoMp: any = null;

  if (intent && paymentId) {
    const { data: fila } = await supabase.from("booking_deposits").select("status, appointment_id").eq("payment_id", paymentId).maybeSingle();
    deposito = (fila as any) || null;
    if (!deposito) {
      // El aviso de Mercado Pago todavia no llego: se consulta el pago con el token del negocio y solo cuenta si es de esta reserva.
      try {
        const cred = await cargarCredencialAbono(supabase, (intent as any).tenant_id);
        if (cred.token) {
          const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${cred.token}` }, cache: "no-store" });
          if (r.ok) { const p = await r.json(); pagoMp = { status: p.status, status_detail: p.status_detail, external_reference: p.external_reference }; }
        }
      } catch { /* sin consulta a Mercado Pago se decide con lo que ya se sabe */ }
    }
  }

  const estado = decidirEstadoAbono({ intent: intent ? { data: (intent as any).data, created_at: (intent as any).created_at } : null, deposito, pagoMp, ref, ahora: Date.now(), segundosDeCobro: HOLD_SEGUNDOS });
  // Con el pago confirmado se muestra la cuenta (solo montos, ningún dato personal).
  const d: any = (intent as any)?.data;
  const resumen = estado.estado === "pagado" && d?.totalPrice ? { ...resumenAbono(d.totalPrice, d.descuento || 0, d.depositAmount), codigo: d.cupon || null } : null;
  return NextResponse.json(resumen ? { ...estado, resumen } : estado, { headers: { "Cache-Control": "no-store" } });
}
