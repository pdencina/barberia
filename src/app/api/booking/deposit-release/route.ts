import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { liberarHold } from "@/lib/deposit-hold";

export const dynamic = "force-dynamic";

// El cliente cancela, se le acaba el tiempo o el pago falla: se libera el horario que se le había reservado, para que pueda reintentar al tiro.
// Público a propósito: la referencia es un UUID imposible de adivinar. Si el pago ya se aprobó, no hace nada.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const ref = String(body?.ref || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) return NextResponse.json({ error: "Referencia no válida" }, { status: 400 });
  const sb = createAdminSupabase();
  const { data } = await sb.from("booking_intents").select("data").eq("ref", ref).maybeSingle();
  const d: any = data?.data;
  if (d && d.resultado !== "pagado" && d.holdRef) await liberarHold(sb, d.holdRef);
  return NextResponse.json({ ok: true });
}
