import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest, requireRole } from "@/lib/supabase/server";

// GET: List invite codes for a tenant
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  // Never trust the tenantId coming from the browser — see resolveTenantForRequest.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));

  if (!tenantId || tenantId === "ALL") return NextResponse.json([]);

  const { data } = await supabase
    .from("invite_codes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  return NextResponse.json(data || []);
}

// POST: Generate a new invite code
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  // SEGURIDAD: antes no pedia sesion y el negocio venia del navegador: cualquiera podia generar un codigo de invitacion para el negocio de otro
  // y registrarse como profesional dentro de el. Solo el administrador (o super admin), y el negocio sale de su sesion.
  const g = await requireRole(["admin", "super_admin"]);
  if (!g.ok) return g.response;
  const body = await req.json().catch(() => ({} as any));
  const resolved = await resolveTenantForRequest(body?.tenantId);
  const tenantId = resolved.tenantId;
  const userId = g.userId;

  if (!tenantId || tenantId === "ALL" || resolved.denied) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  // Generate readable code (6 chars uppercase)
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();

  const { data, error } = await supabase
    .from("invite_codes")
    .insert({
      tenant_id: tenantId,
      code,
      uses_remaining: 10,
      created_by: userId || null,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    })
    .select()
    .single();

  if (error) {
    // If table doesn't exist yet, provide helpful message
    if (error.message.includes("relation") || error.code === "42P01") {
      return NextResponse.json({ error: "Tabla invite_codes no existe. Ejecuta la migracion 042." }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// DELETE: Deactivate an invite code
export async function DELETE(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // SEGURIDAD: antes no pedia sesion: cualquiera podia desactivar los codigos de invitacion de cualquier negocio.
  const g = await requireRole(["admin", "super_admin"]);
  if (!g.ok) return g.response;
  const { data: code } = await supabase.from("invite_codes").select("tenant_id").eq("id", id).maybeSingle();
  if (!code) return NextResponse.json({ success: true });
  if (g.role !== "super_admin" && (code as any).tenant_id !== g.tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  await supabase.from("invite_codes").update({ active: false }).eq("id", id);
  return NextResponse.json({ success: true });
}
