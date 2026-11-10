import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { tenantAlumnos, evaluadorActual } from "@/lib/alumnos";

export const dynamic = "force-dynamic";

export async function GET() {
  const ev = await evaluadorActual();
  if (!ev) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sb = createAdminSupabase();
  const [{ data: alumnos }, { data: evals }] = await Promise.all([
    sb.from("course_students").select("*").eq("tenant_id", tenantAlumnos()).eq("active", true).order("class_date", { nullsFirst: false }),
    sb.from("course_evaluations").select("student_id,average,created_at,status").eq("tenant_id", tenantAlumnos()).order("created_at", { ascending: false }),
  ]);
  const por: Record<string, { n: number; ultima: number; borr: number }> = {};
  for (const e of evals || []) {
    const x = (por[e.student_id] ||= { n: 0, ultima: 0, borr: 0 });
    if (e.status === "borrador") x.borr++; else { if (!x.n) x.ultima = Number(e.average); x.n++; }
  }
  return NextResponse.json({
    evaluador: ev.name,
    alumnos: (alumnos || []).map((a) => ({ ...a, evaluaciones: por[a.id]?.n || 0, borradores: por[a.id]?.borr || 0, ultimo_promedio: por[a.id]?.n ? por[a.id].ultima : null })),
  });
}

export async function POST(req: Request) {
  const ev = await evaluadorActual();
  if (!ev) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const first = String(b.first_name || "").trim().slice(0, 80);
  if (!first) return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
  const email = String(b.email || "").trim().toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Correo no válido." }, { status: 400 });
  const { data, error } = await createAdminSupabase().from("course_students")
    .insert({ tenant_id: tenantAlumnos(), first_name: first, last_name: String(b.last_name || "").trim().slice(0, 80), email })
    .select().single();
  if (error) return NextResponse.json({ error: "No se pudo agregar (¿ya existe?)." }, { status: 400 });
  return NextResponse.json({ alumno: data });
}
