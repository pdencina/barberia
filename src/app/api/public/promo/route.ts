import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { todayInChile, dateStrOffset } from "@/lib/utils";
import { motivoCuponNoValido } from "@/lib/cupon-reglas";
import { diasDePromo, detallesPromo } from "@/lib/promo-link";

export const dynamic = "force-dynamic";

// Público (página de promoción): lo que la persona necesita para reservar con un cupón. Nada privado.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const slug = String(sp.get("negocio") || "").toLowerCase().slice(0, 80);
  const codigo = String(sp.get("cupon") || "").trim().toUpperCase().slice(0, 40);
  const sb = createAdminSupabase();
  const norm = (x: string) => String(x || "").replace(/-/g, "").toLowerCase();
  const { data: negocios } = await sb.from("tenants").select("id, name, slug, logo_url, status").eq("active", true);
  const t: any = (negocios || []).find((x: any) => x.slug === slug) || (negocios || []).find((x: any) => norm(x.slug) === norm(slug));
  if (!t || t.status === "suspended") return NextResponse.json({ error: "Negocio no disponible" }, { status: 404 });
  const base = { negocio: { id: t.id, nombre: t.name, slug: t.slug, logo: t.logo_url || null } };

  // Con código, ese; sin código, la promoción activa más nueva que tenga reglas.
  let cupon: any = null;
  if (codigo) cupon = (await sb.from("coupons").select("*").eq("tenant_id", t.id).eq("code", codigo).maybeSingle()).data;
  else cupon = ((await sb.from("coupons").select("*").eq("tenant_id", t.id).eq("active", true).not("conditions", "is", null).order("created_at", { ascending: false }).limit(10)).data || [])
    .find((c: any) => !motivoCuponNoValido({ ...c, conditions: null }, { barberId: "", fecha: "", hora: "" })) || null;
  if (!cupon) return NextResponse.json({ ...base, promo: null, motivo: "No hay una promoción vigente en este momento." });

  // Vigencia general (activo, usos y vencimiento), sin mirar todavía profesional ni hora.
  const general = motivoCuponNoValido({ ...cupon, conditions: null }, { barberId: "", fecha: "", hora: "" });
  const reglas = cupon.conditions || {};
  const dias = diasDePromo(todayInChile(), reglas, cupon.valid_until, dateStrOffset);
  if (general || dias.length === 0) return NextResponse.json({ ...base, promo: null, motivo: general || "La promoción ya terminó." });

  const { data: perfiles } = await sb.from("profiles").select("id, name, avatar_url, role, also_attends_clients").eq("tenant_id", t.id).eq("active", true).order("name");
  const profesionales = (perfiles || [])
    .filter((p: any) => p.role === "barber" || ((p.role === "admin" || p.role === "super_admin") && p.also_attends_clients))
    .filter((p: any) => !reglas.profesionalIds?.length || reglas.profesionalIds.includes(p.id))
    .map((p: any) => ({ id: p.id, nombre: String(p.name || "").trim(), foto: p.avatar_url || null }));

  return NextResponse.json({
    ...base,
    promo: {
      codigo: cupon.code, descripcion: cupon.description || null,
      tipo: cupon.discount_type, valor: Number(cupon.discount_value) || 0,
      titulo: reglas.titulo || null, imagen: reglas.imagen || null,
      personas: Number(reglas.personas) === 2 ? 2 : 1,
      horaDesde: reglas.horaDesde || null, horaHasta: reglas.horaHasta || null,
      dias, detalles: detallesPromo(reglas, profesionales.map((p: any) => p.nombre)),
      profesionales,
    },
  });
}
