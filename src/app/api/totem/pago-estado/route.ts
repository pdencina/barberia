import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, demasiadosIntentos, ipDe } from "@/lib/totem";

// GET ?codigo=&id=: el totem pregunta si el pago por QR ya se confirmó. Solo devuelve el estado.
export async function GET(req: NextRequest) {
  if (demasiadosIntentos(`pagoest:${ipDe(req)}`, 120)) return NextResponse.json({ error: "Muchos intentos" }, { status: 429 });
  const supabase = createAdminSupabase();
  const sp = new URL(req.url).searchParams;
  const t = await negocioDelTotem(supabase, sp.get("codigo"));
  const id = sp.get("id") || "";
  if (!t || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ estado: "desconocido" }, { status: 404 });
  const { data } = await supabase.from("kiosk_payments").select("status").eq("id", id).eq("tenant_id", t.id).maybeSingle();
  return NextResponse.json({ estado: (data as any)?.status || "desconocido" }, { headers: { "Cache-Control": "no-store" } });
}
