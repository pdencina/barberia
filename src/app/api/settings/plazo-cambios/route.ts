import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCallerForView } from "@/lib/supabase/server";
import { getPlazoCambios, plazoValido, PLAZO_MAXIMO } from "@/lib/cambio-cliente";

// Plazo para que el cliente cancele o modifique su cita desde el correo (solo administrador). tenants.client_change_hours (migración 144).
async function admin() {
  const c = await getCallerForView();
  if ((c.role !== "admin" && c.role !== "super_admin") || !c.tenantId || c.tenantId === "ALL") return null;
  return c;
}

export async function GET() {
  const c = await admin();
  if (!c) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const supabase = createAdminSupabase();
  const { error } = await supabase.from("tenants").select("client_change_hours").eq("id", c.tenantId!).maybeSingle();
  return NextResponse.json({ hours: await getPlazoCambios(supabase, c.tenantId), migrationMissing: !!error });
}

export async function POST(req: NextRequest) {
  const c = await admin();
  if (!c) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({} as any));
  const hours = plazoValido(body?.hours);
  if (hours === null) return NextResponse.json({ error: `Pon un número entero de horas entre 0 y ${PLAZO_MAXIMO}.` }, { status: 400 });
  const supabase = createAdminSupabase();
  const { error } = await supabase.from("tenants").update({ client_change_hours: hours }).eq("id", c.tenantId!);
  if (error) return NextResponse.json({ error: /does not exist|schema cache/i.test(error.message) ? "Falta aplicar la migración 144 en la base de datos." : error.message }, { status: 500 });
  return NextResponse.json({ success: true, hours });
}
