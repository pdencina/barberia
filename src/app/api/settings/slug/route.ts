import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireTenantRole } from "@/lib/supabase/server";
import { alternativas, linkNegocio, linkProfesional, normalizarSlug, validarSlug } from "@/lib/slugs";

export const dynamic = "force-dynamic";

// Link limpio del negocio (re-booking.cl/<negocio>) y de cada profesional (re-booking.cl/<negocio>/<profesional>).
// GET = «¿está disponible?»; POST = cambiarlo. Solo administrador y solo de su negocio. Un link viejo de un negocio sigue funcionando (historial).
const sinSeparadores = (s: string) => s.replace(/-/g, "");

async function revisar(sb: any, tenantId: string, tipo: string, valor: string, barberId: string | null): Promise<{ ok: boolean; error?: string; slug: string }> {
  const slug = normalizarSlug(valor);
  const malo = validarSlug(slug);
  if (malo) return { ok: false, error: malo, slug };
  if (tipo === "negocio") {
    const { data: todos } = await sb.from("tenants").select("id, slug");
    // «lookyestudio» y «looky-estudio» se confunden entre sí (la página de reservas tolera guiones), por eso se consideran el mismo nombre.
    const choque = (todos || []).find((t: any) => t.id !== tenantId && t.slug && sinSeparadores(String(t.slug).toLowerCase()) === sinSeparadores(slug));
    if (choque) return { ok: false, error: "Ese link ya lo usa otro negocio (o es muy parecido). Prueba con otro.", slug };
    const { data: hist, error } = await sb.from("tenant_slug_history").select("tenant_id").eq("old_slug", slug).maybeSingle();
    if (!error && hist && hist.tenant_id !== tenantId) return { ok: false, error: "Ese link perteneció a otro negocio. Prueba con otro.", slug };
    return { ok: true, slug };
  }
  if (tipo === "profesional") {
    if (!barberId) return { ok: false, error: "Falta el profesional", slug };
    const { data: pro } = await sb.from("profiles").select("id").eq("id", barberId).eq("tenant_id", tenantId).maybeSingle();
    if (!pro) return { ok: false, error: "Profesional no encontrado", slug };
    const { data: otros } = await sb.from("profiles").select("id").eq("tenant_id", tenantId).eq("booking_slug", slug).neq("id", barberId);
    if ((otros || []).length > 0) return { ok: false, error: "Otro profesional de tu negocio ya usa ese nombre. Prueba con otro.", slug };
    return { ok: true, slug };
  }
  return { ok: false, error: "Tipo no válido", slug };
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const guard = await requireTenantRole(["admin", "super_admin"], sp.get("tenantId"));
  if (!guard.ok) return guard.response;
  const r = await revisar(createAdminSupabase(), guard.tenantId, sp.get("tipo") || "negocio", sp.get("valor") || "", sp.get("barberId"));
  return NextResponse.json({ disponible: r.ok, slug: r.slug, error: r.error || null, alternativas: r.ok ? [] : alternativas(r.slug || sp.get("valor") || "") });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const guard = await requireTenantRole(["admin", "super_admin"], body.tenantId);
  if (!guard.ok) return guard.response;
  const sb = createAdminSupabase();
  const tipo = String(body.tipo || "negocio");
  const r = await revisar(sb, guard.tenantId, tipo, String(body.valor || ""), body.barberId ? String(body.barberId) : null);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });

  if (tipo === "negocio") {
    const { data: actual } = await sb.from("tenants").select("slug").eq("id", guard.tenantId).maybeSingle();
    if (actual?.slug === r.slug) return NextResponse.json({ success: true, slug: r.slug, link: linkNegocio(r.slug) });
    const { error } = await sb.from("tenants").update({ slug: r.slug }).eq("id", guard.tenantId);
    if (error) return NextResponse.json({ error: /duplicate|unique/i.test(error.message) ? "Ese link ya está en uso." : "No se pudo cambiar el link" }, { status: 409 });
    // El link anterior queda guardado para que siga funcionando (sin la migración 134 se omite).
    if (actual?.slug) await sb.from("tenant_slug_history").upsert({ old_slug: actual.slug, tenant_id: guard.tenantId }, { onConflict: "old_slug" }).then(() => {}, () => {});
    return NextResponse.json({ success: true, slug: r.slug, link: linkNegocio(r.slug), anterior: actual?.slug || null });
  }
  const { error } = await sb.from("profiles").update({ booking_slug: r.slug }).eq("id", body.barberId).eq("tenant_id", guard.tenantId);
  if (error) return NextResponse.json({ error: "No se pudo cambiar el link del profesional" }, { status: 409 });
  const { data: t } = await sb.from("tenants").select("slug").eq("id", guard.tenantId).maybeSingle();
  return NextResponse.json({ success: true, slug: r.slug, link: t?.slug ? linkProfesional(t.slug, r.slug) : null });
}
