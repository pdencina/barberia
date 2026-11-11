import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, demasiadosIntentos, ipDe } from "@/lib/totem";
import { confirmarPagoTotem } from "@/lib/totem-pago";
import { resolverTerminal, consultarCobro } from "@/lib/totem-terminal";

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

  const { data } = await supabase.from("kiosk_payments").select("id, tenant_id, appointment_id, amount, status, method, provider, external_id, created_at, checked_at").eq("id", id).eq("tenant_id", t.id).maybeSingle();
  const kp: any = data;
  if (!kp) return NextResponse.json({ estado: "desconocido" }, { headers: { "Cache-Control": "no-store" } });

  if (kp.method === "terminal" && kp.status === "pending" && kp.external_id) {
    const edad = Date.now() - new Date(kp.created_at).getTime();
    const desdeUltima = kp.checked_at ? Date.now() - new Date(kp.checked_at).getTime() : Infinity;
    if (desdeUltima >= 4000) {
      await supabase.from("kiosk_payments").update({ checked_at: new Date().toISOString() }).eq("id", kp.id);
      // La máquina es la del profesional de la cita (si tiene la suya) o la del negocio, igual que al crear el cobro.
      const { data: ap } = await supabase.from("appointments").select("barber_id").eq("id", kp.appointment_id).maybeSingle();
      const term = await resolverTerminal(supabase, t.id, (ap as any)?.barber_id);
      const est = term ? await consultarCobro(term, kp.external_id) : "pending";
      if (est === "approved") {
        await confirmarPagoTotem(supabase, kp, Number(kp.amount), `${kp.provider}:${kp.external_id}`, "con tarjeta en la máquina");
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
