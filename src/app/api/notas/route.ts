import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { validarNota } from "@/lib/oti/notas";

export const dynamic = "force-dynamic";

// Notas del administrador (Dashboard y Oti). Privadas: cada administrador ve y borra SOLO las suyas (el user_id sale de la sesión,
// nunca del navegador). Tolera que falte la migración 140.
async function yo() {
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId || (role !== "admin" && role !== "super_admin")) return null;
  return { userId, tenantId: tenantId && tenantId !== "ALL" ? tenantId : null };
}
const faltaTabla = (m?: string) => /does not exist|schema cache|relation .* admin_notes/i.test(m || "");
const COLS = "id, note, day_of_month, source, created_at";
const aNota = (r: any) => ({ id: r.id, texto: r.note, dia: r.day_of_month ?? null, fuente: r.source, created_at: r.created_at });

export async function GET() {
  const u = await yo();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data, error } = await createAdminSupabase().from("admin_notes").select(COLS).eq("user_id", u.userId).order("created_at", { ascending: true }).limit(100);
  if (error) return NextResponse.json(faltaTabla(error.message) ? { migracionPendiente: true, notas: [] } : { error: "No pude leer tus notas" }, { status: faltaTabla(error.message) ? 200 : 500 });
  return NextResponse.json({ notas: (data || []).map(aNota) });
}

export async function POST(req: NextRequest) {
  const u = await yo();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const v = validarNota(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const sb = createAdminSupabase();
  const { count } = await sb.from("admin_notes").select("id", { count: "exact", head: true }).eq("user_id", u.userId);
  if ((count || 0) >= 50) return NextResponse.json({ error: "Tienes 50 notas: borra alguna antes de agregar otra." }, { status: 409 });
  const { data, error } = await sb.from("admin_notes").insert({ user_id: u.userId, tenant_id: u.tenantId, note: v.value.texto, day_of_month: v.value.dia, source: body?.fuente === "oti" ? "oti" : "manual" }).select(COLS).single();
  if (error) return NextResponse.json({ error: faltaTabla(error.message) ? "Falta aplicar la migración 140 en la base de datos." : "No pude guardar la nota" }, { status: faltaTabla(error.message) ? 409 : 500 });
  return NextResponse.json({ success: true, nota: aNota(data) });
}

export async function DELETE(req: NextRequest) {
  const u = await yo();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Nota no válida" }, { status: 400 });
  const { data, error } = await createAdminSupabase().from("admin_notes").delete().eq("id", id).eq("user_id", u.userId).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "No pude borrar la nota" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
  return NextResponse.json({ success: true });
}
