import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { buildReceiptPdf } from "../src/lib/receipt-pdf";
import type { ProMonth } from "../src/lib/ledger";
import type { ProSalesDetail } from "../src/lib/pro-sales-detail";

let fails = 0;
const t = async (n: string, f: () => Promise<void>) => { try { await f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("FALLO " + n + ": " + e.message); } };

const pro: ProMonth = { barberId: "b1", name: "Felipe Meza", mode: "rental", base: 638000, baseLabel: "Arriendo: 22 dias x 29.000", lines: [{ key: "t", label: "Propinas", amount: 35850, effect: 1, source: "auto" }], adjustments: 35850, total: 602150, paid: 0, pending: 602150, paidAt: null, paidBy: null, tax: null } as any;
const venta = (i: number) => ({ id: "v" + i, fecha: `0${1 + (i % 9)}/10 1${i % 10}:30`, cliente: i % 3 ? "Maria Perez Gonzalez" : "Juan", medio: i % 2 ? "cash" : "debit_card", total: 18000 + i * 10, servicios: 17000, productos: i % 5 === 0 ? 1500 : 0, propina: i % 4 === 0 ? 1000 : 0, comisionProductos: 0,
  items: [{ nombre: "Corte de cabello con degradado y perfilado de barba completo", tipo: "servicio" as const, cantidad: 1, total: 17000, comisionProducto: 0, cosmetico: false }, ...(i % 5 === 0 ? [{ nombre: "Coca Cola Zero", tipo: "producto" as const, cantidad: 1, total: 1500, comisionProducto: 0, cosmetico: false }] : [])] });
const sales = (n: number): ProSalesDetail => ({ barberId: "b1", name: "Felipe Meza", rate: 40, resumen: { ventas: n, servicios: 17000 * n, productos: 1500 * Math.ceil(n / 5), propinas: 12000, comisionServicios: null, comisionProductos: 0 }, ventas: Array.from({ length: n }, (_, i) => venta(i)) });

(async () => {
  await t("sin detalle: el recibo sigue saliendo igual (1 pagina)", async () => { const b = await buildReceiptPdf({ businessName: "Estudio Levels", pro, monthLabel: "Octubre 2026" }); assert.equal((await PDFDocument.load(b)).getPageCount(), 1); });
  await t("con detalle de 0 ventas: agrega una pagina de detalle", async () => { const b = await buildReceiptPdf({ businessName: "Estudio Levels", pro, monthLabel: "Octubre 2026", sales: sales(0) }); assert.equal((await PDFDocument.load(b)).getPageCount(), 2); });
  await t("con 120 ventas: pagina correctamente y es un PDF valido", async () => { const b = await buildReceiptPdf({ businessName: "Estudio Levels", pro, monthLabel: "Octubre 2026", sales: sales(120) }); const n = (await PDFDocument.load(b)).getPageCount(); assert.ok(n >= 4 && n <= 12, "paginas: " + n); writeFileSync(process.env.TMPDIR ? process.env.TMPDIR + "/recibo-prueba.pdf" : "/tmp/recibo-prueba.pdf", b); });
  await t("caracteres raros en nombres no rompen el PDF", async () => { const s = sales(3); s.ventas[0].cliente = "José Ñandú Ç 😀"; s.ventas[0].items[0].nombre = "Corte “premium” — niño"; await buildReceiptPdf({ businessName: "Estudio Levels", pro, monthLabel: "Octubre 2026", sales: s }); });
  process.exit(fails ? 1 : 0);
})();
