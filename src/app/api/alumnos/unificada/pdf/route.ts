import { NextResponse } from "next/server";
import { evaluadorActual, cargarParaUnificar } from "@/lib/alumnos";
import { pdfUnificada } from "@/lib/alumnos-pdf";

export const dynamic = "force-dynamic";

// PDF unificado de 2 o más evaluaciones terminadas del mismo alumno: ?ids=a,b
export async function GET(req: Request) {
  if (!(await evaluadorActual())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const r = await cargarParaUnificar(new URL(req.url).searchParams.get("ids"));
  if (!r) return NextResponse.json({ error: "Elige 2 o más evaluaciones terminadas del mismo alumno." }, { status: 400 });
  const nombre = `${r.alumno.first_name} ${r.alumno.last_name}`.trim();
  const pdf = await pdfUnificada(r.evs, nombre);
  return new NextResponse(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="evaluacion-unificada-${nombre.replace(/[^\w]+/g, "-")}.pdf"` },
  });
}
