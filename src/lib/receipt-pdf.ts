import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { ProMonth } from "@/lib/ledger";
import type { ProSalesDetail } from "@/lib/pro-sales-detail";

// Recibo en PDF por profesional y mes (Arriendo o Comision). Verde = lo que suma al profesional, rojo = lo que
// le descuenta. Es un documento de apoyo del negocio: no reemplaza una liquidacion de sueldo ni una boleta.

const GREEN = rgb(0.06, 0.6, 0.34);
const RED = rgb(0.84, 0.2, 0.2);
const DARK = rgb(0.1, 0.12, 0.16);
const GRAY = rgb(0.45, 0.48, 0.53);
const LINE = rgb(0.88, 0.9, 0.92);

// Helvetica (WinAnsi) no dibuja cualquier caracter: se cambian los que no existen para que nunca falle.
const safe = (s: string) =>
  String(s ?? "").replace(/[−–—]/g, "-").replace(/×/g, "x").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

const clp = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("es-CL")}`;

export async function buildReceiptPdf(o: {
  businessName: string;
  logo?: Uint8Array | null;
  pro: ProMonth;
  monthLabel: string; // "Septiembre 2026"
  issuedAt?: Date;
  sales?: ProSalesDetail | null; // detalle de todas las ventas del mes (paginas siguientes)
}): Promise<Uint8Array> {
  const { pro } = o;
  const rental = pro.mode === "rental";
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let logoImg: PDFImage | null = null;
  if (o.logo && o.logo.length > 8) {
    try {
      const png = o.logo[0] === 0x89 && o.logo[1] === 0x50;
      const jpg = o.logo[0] === 0xff && o.logo[1] === 0xd8;
      if (png) logoImg = await pdf.embedPng(o.logo);
      else if (jpg) logoImg = await pdf.embedJpg(o.logo);
    } catch { logoImg = null; }
  }

  const W = 595.28, H = 841.89, M = 48;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const text = (t: string, x: number, yy: number, size: number, f: PDFFont = font, color = DARK) =>
    page.drawText(safe(t), { x, y: yy, size, font: f, color });
  const textRight = (t: string, xr: number, yy: number, size: number, f: PDFFont = font, color = DARK) =>
    page.drawText(safe(t), { x: xr - f.widthOfTextAtSize(safe(t), size), y: yy, size, font: f, color });
  const rule = (yy: number) => page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.7, color: LINE });
  const ensure = (need: number) => {
    if (y - need < M + 60) { page = pdf.addPage([W, H]); y = H - M; }
  };

  // Encabezado: logo + negocio a la izquierda, tipo de recibo a la derecha.
  let textX = M;
  if (logoImg) {
    const maxH = 46, scale = Math.min(maxH / logoImg.height, 140 / logoImg.width);
    const w = logoImg.width * scale, h = logoImg.height * scale;
    page.drawImage(logoImg, { x: M, y: y - h, width: w, height: h });
    textX = M + w + 14;
  }
  text(o.businessName, textX, y - 18, 16, bold);
  text("Recibo del profesional", textX, y - 36, 10, font, GRAY);
  textRight(rental ? "RECIBO DE ARRIENDO" : "RECIBO DE COMISIÓN", W - M, y - 18, 11, bold, DARK);
  textRight(o.monthLabel, W - M, y - 36, 10, font, GRAY);
  y -= 66;
  rule(y);
  y -= 26;

  text("Profesional", M, y, 9, font, GRAY);
  text(pro.name, M, y - 15, 14, bold);
  const issued = (o.issuedAt || new Date()).toLocaleDateString("es-CL", { timeZone: "America/Santiago" });
  textRight("Emitido el", W - M, y, 9, font, GRAY);
  textRight(issued, W - M, y - 15, 11, font, DARK);
  y -= 46;

  // Tabla de conceptos.
  text("CONCEPTO", M, y, 8, bold, GRAY);
  textRight("MONTO", W - M, y, 8, bold, GRAY);
  y -= 8;
  rule(y);
  y -= 20;

  const row = (label: string, amountText: string, color: ReturnType<typeof rgb>, sub?: string) => {
    ensure(sub ? 34 : 24);
    text(label, M, y, 11, font, DARK);
    textRight(amountText, W - M, y, 11, bold, color);
    if (sub) { y -= 12; text(sub, M, y, 8, font, GRAY); }
    y -= 10;
    rule(y);
    y -= 16;
  };

  // En arriendo el valor base es lo que el profesional debe (descuenta); en comision es lo que gana (suma).
  row(pro.baseLabel, `${rental ? "-" : "+"}${clp(pro.base)}`, rental ? RED : GREEN);
  if (pro.lines.length === 0) {
    ensure(24);
    text("Sin otros movimientos este mes.", M, y, 9, font, GRAY);
    y -= 24;
  }
  for (const l of pro.lines) {
    const good = l.effect === 1;
    row(l.label, `${good ? "+" : "-"}${clp(l.amount)}`, good ? GREEN : RED, l.reason ? `${l.reason}${l.by ? ` - ${l.by}` : ""}` : undefined);
  }

  // Total y estado del pago.
  ensure(120);
  y -= 6;
  const owed = pro.total < 0;
  // Un total NEGATIVO significa cosas distintas: en comision el profesional se llevo mas de lo que gano (el debe al
  // negocio); en arriendo los descuentos superan lo que debia pagar (el negocio le debe a el).
  const totalLabel = owed
    ? (rental ? "El negocio le debe al profesional" : "El profesional le debe al negocio")
    : rental ? "Total a cobrar al profesional" : "Total a pagar al profesional";
  text(totalLabel, M, y, 12, bold, DARK);
  textRight(clp(Math.abs(pro.total)), W - M, y, 16, bold, DARK);
  y -= 24;
  text(rental ? "Cobrado" : "Pagado", M, y, 10, font, GRAY);
  textRight(clp(pro.paid), W - M, y, 10, font, DARK);
  y -= 16;
  text("Pendiente", M, y, 10, font, GRAY);
  textRight(clp(pro.pending), W - M, y, 10, bold, pro.pending > 0 ? RED : DARK);
  y -= 16;
  if (pro.paidAt) {
    text(`Último registro: ${new Date(pro.paidAt).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}${pro.paidBy ? ` - ${pro.paidBy}` : ""}`, M, y, 8, font, GRAY);
    y -= 14;
  }

  // Impuesto SII del profesional (migracion 117): solo informativo, no cambia el total de arriba.
  const tax = pro.tax;
  if (tax && tax.kind !== "none") {
    const rate = String(tax.rate).replace(".", ",");
    ensure(96);
    y -= 6;
    text("IMPUESTO SII (informativo, no incluido en el total)", M, y, 8, bold, GRAY);
    y -= 8;
    rule(y);
    y -= 18;
    const taxRow = (label: string, amountText: string, strong = false) => {
      ensure(20);
      text(label, M, y, 10, strong ? bold : font, DARK);
      textRight(amountText, W - M, y, 10, strong ? bold : font, DARK);
      y -= 16;
    };
    if (tax.kind === "retencion") {
      taxRow("Boleta de honorarios a emitir por el profesional", clp(tax.documentTotal));
      taxRow(`Retencion ${rate}% (la declara el negocio)`, `-${clp(tax.amount)}`);
      taxRow("Neto de la boleta", clp(tax.finalAmount), true);
    } else {
      taxRow(`Base: ${rental ? "arriendo" : "comision"}`, clp(tax.base));
      taxRow(`IVA ${rate}%`, `+${clp(tax.amount)}`);
      taxRow(rental ? "Total del arriendo con IVA" : "Total de la factura con IVA", clp(tax.documentTotal), true);
    }
    y -= 4;
  }

  // Firmas y nota.
  ensure(110);
  y -= 50;
  page.drawLine({ start: { x: M, y }, end: { x: M + 190, y }, thickness: 0.7, color: GRAY });
  page.drawLine({ start: { x: W - M - 190, y }, end: { x: W - M, y }, thickness: 0.7, color: GRAY });
  text("Firma profesional", M, y - 12, 8, font, GRAY);
  textRight("Firma administración", W - M, y - 12, 8, font, GRAY);
  text("Verde: suma al profesional. Rojo: descuenta al profesional. Documento de apoyo generado con re-booking.", M, M - 8, 7, font, GRAY);

  // ---- Detalle de TODAS las ventas del mes (paginas siguientes) ----
  if (o.sales) {
    const sd = o.sales;
    const MEDIOS: Record<string, string> = { cash: "Efectivo", debit_card: "Debito", credit_card: "Credito", transfer: "Transf.", mixed: "Mixto", mercadopago: "M. Pago" };
    // Privacidad: solo nombre de pila e inicial del apellido.
    const corto = (n: string) => { const p = String(n || "").trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || "-"; };
    const wrap = (t: string, width: number, size: number, f: PDFFont = font): string[] => {
      const words = safe(t).split(/\s+/).filter(Boolean); const lines: string[] = []; let cur = "";
      for (const w of words) { const next = cur ? `${cur} ${w}` : w; if (f.widthOfTextAtSize(next, size) <= width) cur = next; else { if (cur) lines.push(cur); cur = w; } }
      if (cur) lines.push(cur);
      return lines.length ? lines : ["-"];
    };
    page = pdf.addPage([W, H]); y = H - M;
    text(o.businessName, M, y - 6, 12, bold);
    textRight("DETALLE DE VENTAS", W - M, y - 6, 11, bold, DARK);
    text(`${pro.name} - ${o.monthLabel}`, M, y - 22, 10, font, GRAY);
    textRight(`${sd.resumen.ventas} ventas`, W - M, y - 22, 10, font, GRAY);
    y -= 44; rule(y); y -= 20;
    const sum = (label: string, val: string, note?: string) => { text(label, M, y, 9, font, GRAY); if (note) text(note, M + 150, y, 8, font, GRAY); textRight(val, W - M, y, 10, bold, DARK); y -= 15; };
    sum("Servicios", clp(sd.resumen.servicios), rental ? undefined : `base de su ${sd.rate}%`);
    sum("Productos vendidos", clp(sd.resumen.productos), "no suman al profesional (solo cosmeticos dan comision)");
    sum("Propinas", clp(sd.resumen.propinas), "100% para el profesional");
    sum("Comision por cosmeticos", clp(sd.resumen.comisionProductos));
    if (!rental && sd.resumen.comisionServicios !== null) sum(`Comision sobre servicios (${sd.rate}%)`, clp(sd.resumen.comisionServicios));
    y -= 6;
    const cF = M, cC = M + 58, cD = M + 150, cP = M + 330, cT = W - M - 52, cTot = W - M;
    const header = () => {
      text("FECHA", cF, y, 7, bold, GRAY); text("CLIENTE", cC, y, 7, bold, GRAY); text("QUE SE VENDIO", cD, y, 7, bold, GRAY); text("PAGO", cP, y, 7, bold, GRAY);
      textRight("PROPINA", cT, y, 7, bold, GRAY); textRight("TOTAL", cTot, y, 7, bold, GRAY); y -= 6; rule(y); y -= 12;
    };
    header();
    if (sd.ventas.length === 0) { text("Sin ventas este mes.", M, y, 9, font, GRAY); y -= 16; }
    for (const v of sd.ventas) {
      const itemLines: Array<{ t: string; prod: boolean }> = [];
      if (v.items.length === 0) itemLines.push({ t: "(sin detalle)", prod: false });
      for (const it of v.items) {
        const label = `${it.cantidad > 1 ? `${it.cantidad}x ` : ""}${it.nombre} ${clp(it.total)}${it.tipo === "producto" ? (it.comisionProducto > 0 ? ` [PRODUCTO, comision ${clp(it.comisionProducto)}]` : " [PRODUCTO, no va al profesional]") : ""}`;
        for (const l of wrap(label, 168, 7.5)) itemLines.push({ t: l, prod: it.tipo === "producto" });
      }
      const need = Math.max(14, itemLines.length * 10 + 6);
      if (y - need < M + 30) { page = pdf.addPage([W, H]); y = H - M; header(); }
      text(v.fecha, cF, y, 7.5, font, DARK); text(corto(v.cliente), cC, y, 7.5, font, DARK);
      itemLines.forEach((l, k) => text(l.t, cD, y - k * 10, 7.5, font, l.prod ? RED : DARK));
      text(MEDIOS[v.medio] || v.medio || "-", cP, y, 7.5, font, DARK);
      textRight(v.propina > 0 ? clp(v.propina) : "-", cT, y, 7.5, font, DARK); textRight(clp(v.total), cTot, y, 7.5, bold, DARK);
      y -= need; page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.4, color: LINE });
    }
    text("Rojo: producto (no va al profesional salvo cosmeticos). Documento de apoyo generado con re-booking.", M, M - 8, 7, font, GRAY);
  }

  return pdf.save();
}
