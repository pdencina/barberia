import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { PASOS_VALIDOS, parseUserAgent } from "@/lib/embudo";
import { slugifyAd } from "@/lib/ad-tracking";

// Recibe un paso del embudo de ventas (solo para visitas que llegan por un link de vendedor o creador). Anonimo: no guarda IP.
// Un mismo paso de una misma visita se guarda una sola vez (indice unico), asi repetirlo no suma ni se puede inflar.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any));
  const visit = String(b.visit || "");
  const step = String(b.step || "");
  const source = slugifyAd(String(b.source || ""), 30);
  const campaign = slugifyAd(String(b.campaign || ""), 40);
  if (!/^[a-f0-9]{16,40}$/.test(visit) || !PASOS_VALIDOS.includes(step)) return NextResponse.json({ ok: false }, { status: 400 });
  if (source !== "vendedor" && source !== "creador") return NextResponse.json({ ok: false }); // solo se mide este trafico
  const ua = parseUserAgent(req.headers.get("user-agent") || "");
  let city = req.headers.get("x-vercel-ip-city") || "";
  try { city = decodeURIComponent(city); } catch {}
  const plan = typeof b.plan === "string" && /^[a-z0-9_-]{2,20}$/.test(b.plan) ? b.plan : null;
  const { error } = await createAdminSupabase().from("funnel_events").insert({
    visit_id: visit, step, source, campaign: campaign || null, plan,
    device: ua.device, os: ua.os, browser: ua.browser, city: city.slice(0, 60) || null,
  });
  // Duplicado (23505) o tabla sin migrar: no se avisa al navegador, que no debe fallar por esto.
  return NextResponse.json({ ok: !error });
}
