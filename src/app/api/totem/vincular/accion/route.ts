import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { demasiadosIntentos, ipDe, VIGENCIA_VINCULO_MS } from "@/lib/totem";

// POST {t, accion: "pagar"|"llegue"}: el cliente, ya reconocido en su celular, elige «Ir a pagar» o «Avisar mi llegada»; el tótem avanza solo.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`vinc-accion:${ipDe(req)}`, 20)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const token = String(body.t || "");
  const accion = body.accion === "pagar" ? "pagar" : body.accion === "llegue" ? "llegue" : null;
  if (!/^[A-Z0-9]{10}$/.test(token) || !accion) return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  const { data: l } = await supabase.from("kiosk_links").select("created_at, code").eq("token", token).maybeSingle();
  if (!l || Date.now() - new Date((l as any).created_at).getTime() > VIGENCIA_VINCULO_MS) return NextResponse.json({ error: "Este código QR venció. Vuelve a tocar «Ver mi código» en la pantalla." }, { status: 410 });
  if (!(l as any).code) return NextResponse.json({ error: "Primero escribe tu correo." }, { status: 400 });
  await supabase.from("kiosk_links").update({ accion }).eq("token", token);
  return NextResponse.json({ ok: true });
}
