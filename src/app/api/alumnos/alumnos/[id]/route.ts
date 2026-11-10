import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { tenantAlumnos, evaluadorActual } from "@/lib/alumnos";

export const dynamic = "force-dynamic";

// Historial de evaluaciones del alumno (cada una con quien evaluó).
export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!(await evaluadorActual())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sb = createAdminSupabase();
  const { data: alumno } = await sb.from("course_students").select("*").eq("id", params.id).eq("tenant_id", tenantAlumnos()).maybeSingle();
  if (!alumno) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { data } = await sb.from("course_evaluations").select("*").eq("student_id", params.id).eq("tenant_id", tenantAlumnos()).order("created_at", { ascending: false });
  return NextResponse.json({ alumno, evaluaciones: data || [] });
}

// Corregir el correo del alumno.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await evaluadorActual())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Correo no válido." }, { status: 400 });
  const { error } = await createAdminSupabase().from("course_students").update({ email }).eq("id", params.id).eq("tenant_id", tenantAlumnos());
  if (error) return NextResponse.json({ error: "No se pudo guardar." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
