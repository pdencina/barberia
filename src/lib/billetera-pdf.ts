// Reporte del mes de Mi Billetera en PDF (se arma en el navegador con pdf-lib; no sale nada del teléfono ni del computador).
import type { Reparto, CategoriaPct } from "@/lib/billetera";

export interface DatosReporte {
  nombre: string;
  mesTexto: string;            // «Noviembre 2026»
  reparto: Reparto;
  sueldo: number;
  otrosIngresos: number;
  ahorroPct: number;
  categorias: CategoriaPct[];
  lectura: string[];
}

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

export async function generarPdfBilletera(d: DatosReporte): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  const gris = rgb(0.42, 0.45, 0.5), oscuro = rgb(0.1, 0.12, 0.16), azul = rgb(0.06, 0.55, 0.55);
  let y = 790;
  const texto = (t: string, x: number, size = 11, bold = false, color = oscuro) => page.drawText(t, { x, y, size, font: bold ? negrita : fuente, color });
  const salto = (n: number) => { y -= n; if (y < 60) { page = doc.addPage([595, 842]); y = 790; } };
  const derecha = (t: string, xFin: number, size = 11, bold = false) => page.drawText(t, { x: xFin - (bold ? negrita : fuente).widthOfTextAtSize(t, size), y, size, font: bold ? negrita : fuente, color: oscuro });
  // Ajusta un párrafo al ancho de la página.
  const parrafo = (t: string, x: number, ancho: number, size = 11) => {
    let linea = "";
    for (const p of t.split(" ")) {
      const prueba = linea ? `${linea} ${p}` : p;
      if (fuente.widthOfTextAtSize(prueba, size) > ancho) { texto(linea, x, size, false, oscuro); salto(size + 4); linea = p; } else linea = prueba;
    }
    if (linea) { texto(linea, x, size, false, oscuro); salto(size + 4); }
  };

  texto("Mi Billetera · Reporte del mes", 50, 20, true, azul); salto(24);
  texto(`${d.nombre} · ${d.mesTexto}`, 50, 12, false, gris); salto(30);

  texto("Resumen", 50, 13, true); salto(20);
  const fila = (etq: string, monto: number, pct?: number, negrita_ = false) => {
    texto(etq, 50, 11, negrita_); derecha(peso(monto), 400, 11, negrita_);
    if (pct !== undefined) derecha(`${pct} %`, 500, 11, negrita_);
    salto(18);
  };
  fila("Sueldo del mes", d.sueldo);
  if (d.otrosIngresos > 0) fila("Otros ingresos", d.otrosIngresos);
  fila("Ingresos totales", d.reparto.base, 100, true);
  salto(6);
  fila("Gastos personales", d.reparto.gastos, d.reparto.pct.gastos);
  fila(`Ahorro apartado (${Math.round(d.ahorroPct)} %)`, d.reparto.ahorro, d.reparto.pct.ahorro);
  fila("Saldo restante", d.reparto.saldo, d.reparto.pct.saldo, true);
  if (d.reparto.sobregiro > 0) { salto(4); texto(`Atención: los gastos más el ahorro superan los ingresos por ${peso(d.reparto.sobregiro)}.`, 50, 10, true); salto(18); }

  salto(14);
  texto("Gastos por categoría", 50, 13, true); salto(20);
  if (d.categorias.length === 0) { texto("No hay gastos anotados este mes.", 50, 11, false, gris); salto(18); }
  for (const c of d.categorias) {
    texto(c.category, 50); derecha(peso(c.amount), 330); derecha(`${c.pctGastos} % de los gastos`, 450, 10); derecha(`${c.pctBase} % del ingreso`, 548, 10); salto(17);
  }

  salto(14);
  texto("Lectura del mes", 50, 13, true); salto(20);
  for (const l of d.lectura) parrafo(`• ${l}`, 50, 495);

  salto(10);
  texto("Documento personal generado desde re-booking. Solo tú ves estos datos.", 50, 9, false, gris);
  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
