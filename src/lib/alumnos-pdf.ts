import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CRITERIOS, ESCALA, fechaCL, lineas, etiquetas, unificar } from "@/lib/alumnos";

// Las fuentes estándar del PDF solo aceptan Latin-1: lo demás (emojis, símbolos) se cambia por "?" para no romper el PDF.
const limpio = (t: string) => String(t ?? "").replace(/[^\x20-\x7E\xA0-\xFF\u2022]/g, "?");

const teal = rgb(0.06, 0.55, 0.55), gris = rgb(0.4, 0.4, 0.4);

// Escritor simple con salto de página automático.
async function nuevo() {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const b = await doc.embedFont(StandardFonts.HelveticaBold);
  let p: PDFPage = doc.addPage([595, 842]);
  let y = 790;
  const w = {
    get y() { return y; },
    baja(n: number) { y -= n; if (y < 60) { p = doc.addPage([595, 842]); y = 790; } },
    texto(t: string, o: { x?: number; size?: number; bold?: boolean; color?: any } = {}) {
      p.drawText(limpio(t), { x: o.x ?? 50, y, size: o.size ?? 11, font: o.bold ? b : f, color: o.color });
    },
    linea() { p.drawLine({ start: { x: 50, y: y + 8 }, end: { x: 545, y: y + 8 }, thickness: 1, color: teal }); },
    // Viñetas: cada línea del comentario es un punto aparte, con ajuste de ancho.
    comentarios(texto: string | null, titulo: string) {
      this.baja(30); this.texto(titulo, { bold: true, size: 11 });
      const ls = lineas(texto);
      if (!ls.length) { this.baja(16); this.texto("Sin comentarios.", { size: 10, color: gris }); return; }
      for (const l of ls) {
        const palabras = limpio(l).split(/\s+/);
        let cur = "", primera = true;
        const emite = () => { this.baja(15); this.texto((primera ? "\u2022 " : "   ") + cur, { size: 10, x: 56 }); primera = false; };
        for (const pal of palabras) {
          const prueba = cur ? cur + " " + pal : pal;
          if (f.widthOfTextAtSize("   " + prueba, 10) > 480 && cur) { emite(); cur = pal; } else cur = prueba;
        }
        if (cur) emite();
        this.baja(3);
      }
    },
    ancho: (t: string, s: number, bold = false) => (bold ? b : f).widthOfTextAtSize(limpio(t), s),
    doc,
  };
  return w;
}

// PDF de una evaluación: siempre lleva el nombre de quien evaluó.
export async function pdfEvaluacion(ev: any, alumno: string): Promise<Uint8Array> {
  const w = await nuevo();
  w.texto("Estudio Levels", { size: 12, bold: true, color: teal }); w.baja(28);
  w.texto("Evaluación práctica de desempeño en barbería", { size: 18, bold: true }); w.baja(30);
  w.texto(`Alumno: ${alumno}`, { size: 12, bold: true }); w.baja(18);
  w.texto(`Evaluó: ${ev.evaluator_name}`, { size: 12, bold: true }); w.baja(18);
  w.texto(`Fecha: ${fechaCL(ev.created_at)}`, { size: 11, color: gris }); w.baja(22);
  w.texto(`Escala: ${ESCALA}`, { size: 9, color: gris }); w.baja(24);
  w.linea();
  for (const c of CRITERIOS) {
    w.baja(22);
    w.texto(c.nombre, { size: 12, bold: true });
    w.texto(`${ev.scores[c.key]} / 7`, { x: 480, size: 12, bold: true });
    w.baja(13);
    w.texto(c.desc, { size: 9, color: gris });
  }
  w.baja(30);
  w.texto(`Suma de notas: ${ev.total} / 49`, { size: 13, bold: true }); w.baja(20);
  w.texto(`Nota promedio: ${Number(ev.average).toFixed(2)} / 7`, { size: 13, bold: true, color: teal });
  w.comentarios(ev.comments, "Comentarios del instructor");
  return w.doc.save();
}

// PDF unificado: notas de cada evaluador lado a lado, promedio por criterio y comentarios separados por evaluador.
export async function pdfUnificada(evs: any[], alumno: string): Promise<Uint8Array> {
  const w = await nuevo();
  const et = etiquetas(evs), u = unificar(evs);
  w.texto("Estudio Levels", { size: 12, bold: true, color: teal }); w.baja(28);
  w.texto("Evaluación práctica unificada", { size: 18, bold: true }); w.baja(30);
  w.texto(`Alumno: ${alumno}`, { size: 12, bold: true }); w.baja(18);
  w.texto(`Evaluaron: ${et.join(", ")}`, { size: 11, color: gris }); w.baja(24);
  // columnas: criterio (50) | una por evaluación | promedio
  const area = 545 - 50 - 170, n = evs.length, cw = Math.min(90, area / (n + 1));
  const col = (i: number) => 230 + i * cw;
  w.texto("Criterio", { size: 10, bold: true });
  et.forEach((e, i) => { const t = e.length > 14 ? e.slice(0, 13) + "." : e; w.texto(t, { x: col(i), size: 9, bold: true, color: teal }); });
  w.texto("Promedio", { x: col(n), size: 9, bold: true, color: teal });
  w.baja(14); w.linea();
  CRITERIOS.forEach((c, k) => {
    w.baja(20);
    w.texto(c.nombre, { size: 11 });
    evs.forEach((e, i) => w.texto(String(e.scores[c.key]), { x: col(i) + 8, size: 11 }));
    w.texto(u.porCriterio[k].toFixed(2), { x: col(n) + 8, size: 11, bold: true, color: teal });
  });
  w.baja(16); w.linea(); w.baja(14);
  w.texto("Nota promedio", { size: 11, bold: true });
  evs.forEach((e, i) => w.texto(Number(e.average).toFixed(2), { x: col(i) + 4, size: 11, bold: true }));
  w.texto(u.promedio.toFixed(2), { x: col(n) + 4, size: 11, bold: true, color: teal });
  w.baja(30);
  w.texto(`Nota final (promedio de las evaluaciones): ${u.promedio.toFixed(2)} / 7`, { size: 13, bold: true, color: teal });
  evs.forEach((e, i) => w.comentarios(e.comments, `Comentarios de ${et[i]}`));
  return w.doc.save();
}
