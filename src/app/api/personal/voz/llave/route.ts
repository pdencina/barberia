import { NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { huellaLlave, nuevaLlave } from "@/lib/voice-key";

export const dynamic = "force-dynamic";

// Gestión (con sesión) de la llave personal del Atajo de iPhone. Una llave activa por persona; generar una nueva revoca la anterior.
async function yo() {
  const { userId, role } = await getCurrentUserRoleAndTenant();
  return userId && role && role !== "client" ? userId : null;
}
const falta = (m?: string) => /does not exist|schema cache/i.test(m || "");

export async function GET() {
  const uid = await yo();
  if (!uid) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data, error } = await createAdminSupabase().from("personal_voice_keys").select("created_at, last_used_at").eq("user_id", uid).is("revoked_at", null).maybeSingle();
  if (error) return NextResponse.json(falta(error.message) ? { migracionPendiente: true } : { error: "No pude leer el estado" }, { status: falta(error.message) ? 200 : 500 });
  return NextResponse.json({ activa: !!data, creada: data?.created_at ?? null, ultimoUso: data?.last_used_at ?? null });
}

export async function POST() {
  const uid = await yo();
  if (!uid) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const llave = nuevaLlave();
  const huella = huellaLlave(llave);
  if (!huella) return NextResponse.json({ error: "El servidor no puede generar llaves ahora" }, { status: 500 });
  const sb = createAdminSupabase();
  const rev = await sb.from("personal_voice_keys").update({ revoked_at: new Date().toISOString() }).eq("user_id", uid).is("revoked_at", null);
  if (rev.error) return NextResponse.json({ error: falta(rev.error.message) ? "Falta aplicar la migración 125 en la base de datos." : "No pude generar la llave" }, { status: falta(rev.error.message) ? 409 : 500 });
  const { error } = await sb.from("personal_voice_keys").insert({ user_id: uid, key_hash: huella });
  if (error) return NextResponse.json({ error: "No pude generar la llave" }, { status: 500 });
  return NextResponse.json({ llave }); // se muestra una sola vez
}

export async function DELETE() {
  const uid = await yo();
  if (!uid) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { error } = await createAdminSupabase().from("personal_voice_keys").update({ revoked_at: new Date().toISOString() }).eq("user_id", uid).is("revoked_at", null);
  if (error) return NextResponse.json({ error: "No pude revocar la llave" }, { status: 500 });
  return NextResponse.json({ success: true });
}
