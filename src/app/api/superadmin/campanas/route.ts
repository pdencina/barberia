import { NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { resumenCampanas } from "@/lib/campanas";

export const dynamic = "force-dynamic";

// Super admin: qué campaña de anuncios trajo cuántas altas y cuánto dinero (suscripciones de re-booking).
export async function GET() {
  const { role } = await getCurrentUserRoleAndTenant();
  if (role !== "super_admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const supabase = createAdminSupabase();
  let migracion = true;
  let { data, error } : { data: any[] | null; error: any } = await supabase.from("signup_requests").select("status, amount, ad_attribution, created_at").order("created_at", { ascending: false }).limit(5000);
  if (error) { // falta la migracion 149: se muestra todo como "directo"
    migracion = false;
    ({ data } = await supabase.from("signup_requests").select("status, amount, created_at").order("created_at", { ascending: false }).limit(5000));
  }
  return NextResponse.json({ migracion, campanas: resumenCampanas((data as any[]) || []) });
}
