import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCallerForView } from "@/lib/supabase/server";
import { validPixelId } from "@/lib/meta-pixel";

// Pixel de Meta propio del negocio (solo admin). Solo se guarda el ID numerico (no es secreto). Migracion 150.
// El negocio sale de la sesion, nunca de lo que mande el navegador.
async function adminOnly() {
  const c = await getCallerForView();
  if (!c.userId || (c.role !== "admin" && c.role !== "super_admin") || !c.tenantId || c.tenantId === "ALL") return null;
  return c;
}

export async function GET() {
  const c = await adminOnly();
  if (!c) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { data, error } = await createAdminSupabase().from("tenants").select("meta_pixel_id").eq("id", c.tenantId!).maybeSingle();
  return NextResponse.json({ pixelId: error ? null : ((data as any)?.meta_pixel_id ?? null), migrationMissing: !!error });
}

export async function PUT(req: NextRequest) {
  const c = await adminOnly();
  if (!c) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const raw = String(b.pixelId ?? "").trim();
  if (raw && !validPixelId(raw)) return NextResponse.json({ error: "El número del Píxel son solo dígitos (entre 8 y 20). Cópialo desde el Administrador de eventos de Meta." }, { status: 400 });
  const { error } = await createAdminSupabase().from("tenants").update({ meta_pixel_id: raw || null }).eq("id", c.tenantId!);
  if (error) return NextResponse.json({ error: /does not exist|schema cache/i.test(error.message) ? "Falta aplicar la migración 150 en la base de datos." : "No se pudo guardar" }, { status: /does not exist|schema cache/i.test(error.message) ? 409 : 500 });
  return NextResponse.json({ success: true, pixelId: raw || null });
}
