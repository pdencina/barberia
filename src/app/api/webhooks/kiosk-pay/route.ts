import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { cargarCredencialAbono, firmaValida } from "@/lib/deposit";
import { confirmarPagoTotem } from "@/lib/totem-pago";

// Aviso de Mercado Pago por un pago hecho con el QR del totem. Opcion A: confirma, marca el cobro como pagado y AVISA al profesional y a
// administración; NO crea la venta (la registra el equipo en el POS). Es idempotente: un mismo pago solo se procesa una vez.
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  try {
    const body = await req.json().catch(() => ({}));
    const topic = body.type || body.topic;
    const paymentId = body.data?.id || String(body.resource || "").split("/").pop();
    if (!paymentId || topic !== "payment") return NextResponse.json({ ok: true });

    const url = new URL(req.url);
    const tenantId = firmaValida(url.searchParams.get("t"), url.searchParams.get("s")) ? url.searchParams.get("t") : null;
    if (!tenantId) return NextResponse.json({ ok: true }); // sin firma válida no se procesa nada

    const cred = await cargarCredencialAbono(supabase, tenantId);
    if (!cred.token) return NextResponse.json({ ok: true });
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${cred.token}` } });
    if (!res.ok) return NextResponse.json({ ok: true });
    const p = await res.json();

    const ref = String(p.external_reference || "");
    if (!ref.startsWith("kp-")) return NextResponse.json({ ok: true });
    const kpId = ref.slice(3);
    if (!/^[0-9a-f-]{36}$/i.test(kpId)) return NextResponse.json({ ok: true });
    if (p.status !== "approved") return NextResponse.json({ ok: true });

    const { data: kp } = await supabase.from("kiosk_payments").select("id, tenant_id, appointment_id, amount, status").eq("id", kpId).eq("tenant_id", tenantId).maybeSingle();
    if (!kp) return NextResponse.json({ ok: true });
    // El monto pagado debe cubrir lo cobrado (nunca se confía en el aviso sin comprobarlo).
    if (Number(p.transaction_amount) + 0.5 < Number((kp as any).amount)) {
      console.error("kiosk-pay: monto pagado menor al cobrado", { kpId, pagado: p.transaction_amount, cobrado: (kp as any).amount });
      return NextResponse.json({ ok: true });
    }

    // Marca como pagado SOLO si seguía sin pagar, avisa y deja constancia (idempotente: un aviso repetido no avisa dos veces).
    await confirmarPagoTotem(supabase, kp as any, Number(p.transaction_amount) || 0, String(paymentId), "por Mercado Pago");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("kiosk-pay webhook error:", e);
    return NextResponse.json({ ok: true }); // siempre 200: Mercado Pago reintenta si no
  }
}
