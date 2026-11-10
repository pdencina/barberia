import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { tenantAlumnos, evaluadorActual, calcular } from "@/lib/alumnos";

export async function POST(req: Request) {
  const ev = await evaluadorActual();
  if (!ev) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const c = calcular(b.scores);
  if (!c.ok) return NextResponse.json({ error: "Faltan notas: pon un 1 a 7 en cada ítem." }, { status: 400 });
  const sb = createAdminSupabase();
  const { data: al } = await sb.from("course_students").select("id").eq("id", String(b.student_id)).eq("tenant_id", tenantAlumnos()).maybeSingle();
  if (!al) return NextResponse.json({ error: "Alumno no encontrado." }, { status: 404 });
  const { data, error } = await sb.from("course_evaluations").insert({
    tenant_id: tenantAlumnos(), student_id: al.id, evaluator_id: ev.id, evaluator_name: ev.name,
    scores: c.scores, total: c.total, average: c.average, comments: String(b.comments || "").trim().slice(0, 4000) || null,
  }).select().single();
  if (error) return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  return NextResponse.json({ evaluacion: data });
}
