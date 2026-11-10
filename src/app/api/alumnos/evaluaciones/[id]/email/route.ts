import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { tenantAlumnos, evaluadorActual, correoEvaluacionHtml } from "@/lib/alumnos";
import { pdfEvaluacion } from "@/lib/alumnos-pdf";
import { getResendClient } from "@/lib/resend-client";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  if (!(await evaluadorActual())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sb = createAdminSupabase();
  const { data: ev } = await sb.from("course_evaluations").select("*, course_students(first_name,last_name,email)").eq("id", params.id).eq("tenant_id", tenantAlumnos()).maybeSingle();
  if (!ev) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (ev.status === "borrador") return NextResponse.json({ error: "Termina la evaluación antes." }, { status: 400 });
  const al = ev.course_students as any;
  if (!al.email) return NextResponse.json({ error: "Este alumno no tiene correo. Agrégalo y reintenta." }, { status: 400 });
  const nombre = `${al.first_name} ${al.last_name}`.trim();
  try {
    const pdf = await pdfEvaluacion(ev, nombre);
    const { error } = await getResendClient().emails.send({
      from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
      to: al.email,
      subject: "Tu evaluación del curso de barbería | Estudio Levels",
      html: correoEvaluacionHtml(ev, nombre),
      attachments: [{ filename: "evaluacion.pdf", content: Buffer.from(pdf) }],
    } as any);
    if (error) throw new Error((error as any).message);
  } catch (e: any) {
    console.error("alumnos email:", e?.message);
    return NextResponse.json({ error: "No se pudo enviar el correo." }, { status: 500 });
  }
  await sb.from("course_evaluations").update({ emailed_at: new Date().toISOString() }).eq("id", ev.id);
  return NextResponse.json({ ok: true });
}
