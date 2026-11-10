import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { tenantAlumnos, evaluadorActual } from "@/lib/alumnos";
import { pdfEvaluacion } from "@/lib/alumnos-pdf";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!(await evaluadorActual())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sb = createAdminSupabase();
  const { data: ev } = await sb.from("course_evaluations").select("*, course_students(first_name,last_name)").eq("id", params.id).eq("tenant_id", tenantAlumnos()).maybeSingle();
  if (!ev) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const al = ev.course_students as any;
  const nombre = `${al.first_name} ${al.last_name}`.trim();
  const pdf = await pdfEvaluacion(ev, nombre);
  return new NextResponse(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="evaluacion-${nombre.replace(/[^\w]+/g, "-")}.pdf"` },
  });
}
