import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { tenantAlumnos } from "@/lib/alumnos";

// Público: solo nombres (sin códigos) para la primera pantalla «¿Quién evalúa?».
export async function GET() {
  const { data } = await createAdminSupabase().from("course_evaluators").select("id,name")
    .eq("tenant_id", tenantAlumnos()).eq("active", true).order("name");
  return NextResponse.json({ evaluadores: data || [] });
}
