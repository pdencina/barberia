import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { statsDeVendedor } from "@/lib/vendedores";
import { analisisEmbudo } from "@/lib/embudo-server";

export const dynamic = "force-dynamic";

// Metricas de UN vendedor, con su enlace privado (token largo e imposible de adivinar). No muestra datos de los clientes: solo
// cantidades, planes, fechas y montos.
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("t") || "";
  if (!/^[a-f0-9]{32}$/.test(token)) return NextResponse.json({ error: "Enlace no válido" }, { status: 404 });
  const supabase = createAdminSupabase();
  const { data: s } = await supabase.from("sellers").select("name, slug, active").eq("token", token).maybeSingle();
  if (!s || !(s as any).active) return NextResponse.json({ error: "Enlace no válido" }, { status: 404 });
  const { data: rows } = await supabase.from("signup_requests").select("status, amount, plan, created_at, ad_attribution").not("ad_attribution", "is", null).limit(5000);
  const analisis = await analisisEmbudo(supabase, (s as any).slug, ((rows as any[]) || []) as any);
  return NextResponse.json({ nombre: (s as any).name, stats: statsDeVendedor((rows as any[]) || [], (s as any).slug), analisis });
}
