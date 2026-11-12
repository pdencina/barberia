import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { evaluadorActual, cargarParaUnificar, correoUnificadoHtml } from "@/lib/alumnos";
import { pdfUnificada } from "@/lib/alumnos-pdf";
import { getResendClient } from "@/lib/resend-client";

// Envía al alumno UN correo con las evaluaciones unificadas (cuadro, nota final y comentarios por evaluador) + PDF.
export async function POST(req: Request) {
  if (!(await evaluadorActual())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const r = await cargarParaUnificar(b.ids, String(b.student_id || ""));
  if (!r) return NextResponse.json({ error: "Elige 2 o más evaluaciones terminadas del mismo alumno." }, { status: 400 });
  if (!r.alumno.email) return NextResponse.json({ error: "Este alumno no tiene correo. Agrégalo y reintenta." }, { status: 400 });
  const nombre = `${r.alumno.first_name} ${r.alumno.last_name}`.trim();
  try {
    const pdf = await pdfUnificada(r.evs, nombre);
    const { error } = await getResendClient().emails.send({
      from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
      to: r.alumno.email,
      subject: "Tu evaluación unificada del curso de barbería | Estudio Levels",
      html: correoUnificadoHtml(r.evs, nombre),
      attachments: [{ filename: "evaluacion-unificada.pdf", content: Buffer.from(pdf) }],
    } as any);
    if (error) throw new Error((error as any).message);
  } catch (e: any) {
    console.error("alumnos email unificada:", e?.message);
    return NextResponse.json({ error: "No se pudo enviar el correo." }, { status: 500 });
  }
  await createAdminSupabase().from("course_evaluations").update({ emailed_at: new Date().toISOString() }).in("id", r.evs.map((e: any) => e.id));
  return NextResponse.json({ ok: true });
}
