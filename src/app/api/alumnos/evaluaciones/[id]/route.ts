import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { tenantAlumnos, evaluadorActual, calcular, parcial } from "@/lib/alumnos";

// Guarda cambios de una evaluación en curso (autoguardado) o corrige una ya hecha.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ev = await evaluadorActual();
  if (!ev) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const sb = createAdminSupabase();
  const { data: cur } = await sb.from("course_evaluations").select("id,status").eq("id", params.id).eq("tenant_id", tenantAlumnos()).maybeSingle();
  if (!cur) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const comments = String(b.comments || "").trim().slice(0, 4000) || null;
  const upd: Record<string, any> = { comments };
  if (cur.status === "final" || b.finalizar) {
    // Una evaluación terminada (o que se está terminando) siempre lleva las 7 notas.
    const c = calcular(b.scores);
    if (!c.ok) return NextResponse.json({ error: "Faltan notas: pon un 1 a 7 en cada ítem." }, { status: 400 });
    Object.assign(upd, { scores: c.scores, total: c.total, average: c.average, status: "final" });
    if (cur.status === "final") Object.assign(upd, { edited_at: new Date().toISOString(), edited_by: ev.name });
  } else {
    const p = parcial(b.scores);
    if (!p) return NextResponse.json({ error: "Notas no válidas." }, { status: 400 });
    Object.assign(upd, { scores: p.scores, total: p.total, average: 0 });
  }
  const { data, error } = await sb.from("course_evaluations").update(upd).eq("id", cur.id).select().single();
  if (error) return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  return NextResponse.json({ evaluacion: data });
}

// Descartar un borrador (las evaluaciones terminadas no se borran).
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!(await evaluadorActual())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data } = await createAdminSupabase().from("course_evaluations").delete()
    .eq("id", params.id).eq("tenant_id", tenantAlumnos()).eq("status", "borrador").select("id");
  if (!data?.length) return NextResponse.json({ error: "Solo se pueden descartar borradores." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
