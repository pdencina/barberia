import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { CRITERIOS, ESCALA, fechaCL } from "@/lib/alumnos";

// PDF de una evaluación: siempre lleva el nombre de quien evaluó.
export async function pdfEvaluacion(ev: any, alumno: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const p = doc.addPage([595, 842]);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const b = await doc.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(0.06, 0.55, 0.55), gris = rgb(0.4, 0.4, 0.4);
  let y = 790;
  p.drawText("Estudio Levels", { x: 50, y, size: 12, font: b, color: teal }); y -= 28;
  p.drawText("Evaluación práctica de desempeño en barbería", { x: 50, y, size: 18, font: b }); y -= 30;
  p.drawText(`Alumno: ${alumno}`, { x: 50, y, size: 12, font: b }); y -= 18;
  p.drawText(`Evaluó: ${ev.evaluator_name}`, { x: 50, y, size: 12, font: b }); y -= 18;
  p.drawText(`Fecha: ${fechaCL(ev.created_at)}`, { x: 50, y, size: 11, font: f, color: gris }); y -= 22;
  p.drawText(`Escala: ${ESCALA}`, { x: 50, y, size: 9, font: f, color: gris }); y -= 24;
  p.drawLine({ start: { x: 50, y: y + 8 }, end: { x: 545, y: y + 8 }, thickness: 1, color: teal });
  for (const c of CRITERIOS) {
    y -= 22;
    p.drawText(c.nombre, { x: 50, y, size: 12, font: b });
    p.drawText(`${ev.scores[c.key]} / 7`, { x: 480, y, size: 12, font: b });
    y -= 13;
    p.drawText(c.desc, { x: 50, y, size: 9, font: f, color: gris });
  }
  y -= 30;
  p.drawText(`Suma de notas: ${ev.total} / 49`, { x: 50, y, size: 13, font: b }); y -= 20;
  p.drawText(`Nota promedio: ${Number(ev.average).toFixed(2)} / 7`, { x: 50, y, size: 13, font: b, color: teal }); y -= 30;
  p.drawText("Comentarios del instructor", { x: 50, y, size: 11, font: b }); y -= 16;
  const words = String(ev.comments || "Sin comentarios.").replace(/\s+/g, " ").split(" ");
  let line = "";
  for (const w of words) {
    if (f.widthOfTextAtSize(line + " " + w, 10) > 490) { p.drawText(line, { x: 50, y, size: 10, font: f }); y -= 14; line = w; }
    else line = line ? line + " " + w : w;
    if (y < 50) break;
  }
  if (line && y >= 50) p.drawText(line, { x: 50, y, size: 10, font: f });
  return doc.save();
}
