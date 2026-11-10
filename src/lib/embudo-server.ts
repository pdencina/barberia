import type { createAdminSupabase } from "@/lib/supabase/server";
import { analizarEmbudo, type EventoEmbudo, type Solicitud } from "@/lib/embudo";

type Admin = ReturnType<typeof createAdminSupabase>;

// Analisis del embudo de un vendedor (slug) o de todos (slug = null). Si falta la migracion 157 devuelve null y el resto sigue andando.
export async function analisisEmbudo(supabase: Admin, slug: string | null, solicitudes: Solicitud[]) {
  let q = supabase.from("funnel_events").select("created_at, visit_id, step, source, campaign, plan, device, os, browser, city").in("source", ["vendedor", "creador"]).order("created_at", { ascending: false }).limit(20000);
  if (slug) q = q.eq("source", "vendedor").eq("campaign", slug);
  const { data, error } = await q;
  if (error) return null;
  const mias = solicitudes.filter((s) => {
    const a = s.ad_attribution || {};
    return slug ? a.utm_source === "vendedor" && a.utm_campaign === slug : a.utm_source === "vendedor" || a.utm_source === "creador";
  });
  return analizarEmbudo((data as EventoEmbudo[]) || [], mias);
}
