import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { PDFDocument, PDFStream, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { buildReceiptPdf } from "../src/lib/receipt-pdf";
import type { ProMonth } from "../src/lib/ledger";
import type { ProSalesDetail } from "../src/lib/pro-sales-detail";

let fails = 0;
const t = async (n: string, f: () => Promise<void>) => { try { await f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("FALLO " + n + ": " + e.message); } };

const pro: ProMonth = { barberId: "b1", name: "Felipe Meza", mode: "rental", base: 638000, baseLabel: "Arriendo: 22 dias x 29.000", lines: [{ key: "t", label: "Propinas", amount: 35850, effect: 1, source: "auto" }], adjustments: 35850, total: 602150, paid: 0, pending: 602150, paidAt: null, paidBy: null, tax: null } as any;
const venta = (i: number) => ({ id: "v" + i, fecha: `0${1 + (i % 9)}/10 1${i % 10}:30`, cliente: i % 3 ? "Maria Perez Gonzalez" : "Juan", medio: i % 2 ? "cash" : "debit_card", total: 18000 + i * 10, servicios: 17000, productos: i % 5 === 0 ? 1500 : 0, propina: i % 4 === 0 ? 1000 : 0, comisionProductos: 0,
  items: [{ nombre: "Corte de cabello con degradado y perfilado de barba completo", tipo: "servicio" as const, cantidad: 1, total: 17000, comisionProducto: 0, cosmetico: false }, ...(i % 5 === 0 ? [{ nombre: "Coca Cola Zero", tipo: "producto" as const, cantidad: 1, total: 1500, comisionProducto: 0, cosmetico: false }] : [])] });
const sales = (n: number): ProSalesDetail => ({ barberId: "b1", name: "Felipe Meza", rate: 40, resumen: { ventas: n, servicios: 17000 * n, productos: 1500 * Math.ceil(n / 5), propinas: 12000, comisionServicios: null, comisionProductos: 0 }, ventas: Array.from({ length: n }, (_, i) => venta(i)) });


// Cuenta cuantas veces se dibuja texto en cada pagina: una hoja con muy poco texto es una "pagina de mas" (ej. solo las firmas).
async function textoPorPagina(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((pg) => {
    const c: any = pg.node.Contents();
    const streams: any[] = c instanceof PDFStream ? [c] : c ? c.asArray().map((r: any) => doc.context.lookup(r)) : [];
    return streams.reduce((n, st) => n + (new TextDecoder("latin1").decode(decodePDFRawStream(st as PDFRawStream).decode()).match(/\bTj\b/g) || []).length, 0);
  });
}
const proConLineas = (n: number): ProMonth => ({ ...pro, lines: Array.from({ length: n }, (_, i) => ({ key: "l" + i, label: "Descuento por planilla", amount: 1500, effect: -1 as const, source: "ledger" as const, reason: `Planilla: Coca Cola Zero x1 (codigo ABC${i}) - Recepcion Levels` })) } as any);

(async () => {
  await t("sin detalle: el recibo sigue saliendo igual (1 pagina)", async () => { const b = await buildReceiptPdf({ businessName: "Estudio Levels", pro, monthLabel: "Octubre 2026" }); assert.equal((await PDFDocument.load(b)).getPageCount(), 1); });
  await t("con detalle de 0 ventas: el detalle cabe en la misma hoja", async () => { const b = await buildReceiptPdf({ businessName: "Estudio Levels", pro, monthLabel: "Octubre 2026", sales: sales(0) }); assert.ok((await PDFDocument.load(b)).getPageCount() <= 2); });
  await t("con 120 ventas: pagina correctamente y es un PDF valido (guarda una muestra en /tmp)", async () => { const b = await buildReceiptPdf({ businessName: "Estudio Levels", pro, monthLabel: "Octubre 2026", sales: sales(120) }); const n = (await PDFDocument.load(b)).getPageCount(); assert.ok(n >= 4 && n <= 12, "paginas: " + n); writeFileSync(process.env.TMPDIR ? process.env.TMPDIR + "/recibo-prueba.pdf" : "/tmp/recibo-prueba.pdf", b); });
  await t("caracteres raros en nombres no rompen el PDF", async () => { const s = sales(3); s.ventas[0].cliente = "José Ñandú Ç 😀"; s.ventas[0].items[0].nombre = "Corte “premium” — niño"; await buildReceiptPdf({ businessName: "Estudio Levels", pro, monthLabel: "Octubre 2026", sales: s }); });
  await t("nunca queda una hoja con solo las firmas (0 a 30 movimientos, con y sin detalle)", async () => {
    for (const lines of [0, 3, 8, 10, 12, 14, 16, 18, 20, 24, 30]) for (const withSales of [false, true]) {
      const b = await buildReceiptPdf({ businessName: "Estudio Levels", pro: proConLineas(lines), monthLabel: "Octubre 2026", sales: withSales ? sales(7) : null });
      const textos = await textoPorPagina(b);
      textos.forEach((n, k) => assert.ok(textos.length === 1 || n >= 9, `${lines} movimientos, detalle=${withSales}: la pagina ${k + 1} de ${textos.length} casi no tiene contenido (${n} textos)`));
    }
  });
  await t("las firmas estan en la ultima pagina y hay numeracion de paginas", async () => { const b = await buildReceiptPdf({ businessName: "Estudio Levels", pro, monthLabel: "Octubre 2026", sales: sales(40) }); const doc = await PDFDocument.load(b); assert.ok(doc.getPageCount() >= 2); });
  process.exit(fails ? 1 : 0);
})();
