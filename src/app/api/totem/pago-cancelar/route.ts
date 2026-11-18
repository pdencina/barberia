import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, demasiadosIntentos, ipDe } from "@/lib/totem";
import { barberDeCobroProductos } from "@/lib/totem-producto";
import { resolverTerminal, cancelarCobro } from "@/lib/totem-terminal";

// POST {codigo, id}: el cliente cancela un cobro en la máquina que aún no se pagó.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`pagocan:${ipDe(req)}`, 20)) return NextResponse.json({ error: "Muchos intentos" }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(supabase, body.codigo);
  const id = String(body.id || "");
  if (!t || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  let rk: any = await supabase.from("kiosk_payments").select("id, status, method, external_id, appointment_id, barber_id, kind, items").eq("id", id).eq("tenant_id", t.id).maybeSingle();
  if (rk.error) rk = await supabase.from("kiosk_payments").select("id, status, method, external_id, appointment_id").eq("id", id).eq("tenant_id", t.id).maybeSingle();
  const kp = rk.data;
  if (!kp) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if ((kp as any).status !== "pending") return NextResponse.json({ ok: true, estado: (kp as any).status }); // si ya se pagó, no se pisa

  let remoto = false;
  if ((kp as any).method === "terminal" && (kp as any).external_id) {
    let bId: string | null = (kp as any).kind === "producto" ? barberDeCobroProductos((kp as any).items, (kp as any).barber_id) : ((kp as any).barber_id || null);
    if (!bId && (kp as any).kind !== "producto" && (kp as any).appointment_id) { const { data: ap } = await supabase.from("appointments").select("barber_id").eq("id", (kp as any).appointment_id).maybeSingle(); bId = (ap as any)?.barber_id || null; }
    const term = await resolverTerminal(supabase, t.id, bId);
    if (term) remoto = (await cancelarCobro(term, (kp as any).external_id)).remoto;
  }
  await supabase.from("kiosk_payments").update({ status: "cancelled" }).eq("id", id).eq("status", "pending");
  return NextResponse.json({ ok: true, estado: "cancelled", remoto });
}
