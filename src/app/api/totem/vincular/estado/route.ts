import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, demasiadosIntentos, ipDe, VIGENCIA_VINCULO_MS } from "@/lib/totem";


// GET ?codigo=&t=: el tótem pregunta cada 2 s si el cliente ya escribió su correo en su celular.
//  esperando -> aún no · vinculado -> ya hay código (se muestra en el tótem) · listo -> además eligió «Ir a pagar» / «Ya llegué» · expirado.
export async function GET(req: NextRequest) {
  if (demasiadosIntentos(`vinc-estado:${ipDe(req)}`, 200)) return NextResponse.json({ error: "Muchos intentos" }, { status: 429 });
  const supabase = createAdminSupabase();
  const sp = new URL(req.url).searchParams;
  const t = await negocioDelTotem(supabase, sp.get("codigo"));
  const token = String(sp.get("t") || "");
  if (!t || !/^[A-Z0-9]{10}$/.test(token)) return NextResponse.json({ estado: "expirado" }, { status: 404 });

  const { data } = await supabase.from("kiosk_links").select("created_at, code, accion, client:clients(name)").eq("token", token).eq("tenant_id", t.id).maybeSingle();
  const l: any = data;
  if (!l || Date.now() - new Date(l.created_at).getTime() > VIGENCIA_VINCULO_MS) return NextResponse.json({ estado: "expirado" }, { headers: { "Cache-Control": "no-store" } });
  if (l.code && l.accion) {
    await supabase.from("kiosk_links").update({ entregado: true }).eq("token", token); // el código ya llegó al tótem
    return NextResponse.json({ estado: "listo", code: l.code, accion: l.accion }, { headers: { "Cache-Control": "no-store" } });
  }
  if (l.code) return NextResponse.json({ estado: "vinculado", code: l.code, nombre: String(l.client?.name || "").trim().split(/\s+/)[0] || "" }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ estado: "esperando" }, { headers: { "Cache-Control": "no-store" } });
}
