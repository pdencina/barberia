"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Download, ListChecks } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import type { ProMode } from "@/lib/ledger";

interface Item { nombre: string; tipo: "servicio" | "producto"; cantidad: number; total: number; comisionProducto: number; cosmetico?: boolean }
interface Venta { id: string; fecha: string; cliente: string; medio: string; total: number; servicios: number; productos: number; propina: number; comisionProductos: number; items: Item[] }
interface Pro { barberId: string; name: string; rate: number; resumen: { ventas: number; servicios: number; productos: number; propinas: number; comisionServicios: number | null; comisionProductos: number }; ventas: Venta[] }

const MEDIOS: Record<string, string> = { cash: "Efectivo", debit_card: "Débito", credit_card: "Crédito", transfer: "Transferencia", mixed: "Mixto", mercadopago: "Mercado Pago" };
const medio = (m: string) => MEDIOS[m] || m || "—";
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Detalle de todas las ventas del mes de cada profesional: de dónde sale lo que se le paga. Solo lectura.
export function MovimientosDetalle({ mode, month, year, tenantQuery, onClose }: { mode: ProMode; month: number; year: number; tenantQuery: string; onClose: () => void }) {
  const [pros, setPros] = useState<Pro[] | null>(null);
  const [error, setError] = useState("");
  const [soloProductos, setSoloProductos] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/profesionales/libro/detalle?mode=${mode}&month=${month}&year=${year}${tenantQuery}`, { cache: "no-store" })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!vivo) return; if (!r.ok) setError(d?.error || "No se pudo cargar el detalle"); else setPros(d.pros || []); })
      .catch(() => vivo && setError("No se pudo cargar el detalle"));
    return () => { vivo = false; };
  }, [mode, month, year, tenantQuery]);

  const descargar = () => {
    if (!pros) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const filas = [["Profesional", "Fecha", "Cliente", "Medio de pago", "Detalle", "Servicios", "Productos", "Propina", "Comisión por productos", "Total venta"].map(esc).join(",")];
    for (const p of pros) for (const v of p.ventas)
      filas.push([p.name, v.fecha, v.cliente, medio(v.medio), v.items.map((i) => `${i.cantidad}× ${i.nombre} (${i.tipo})`).join(" + "), v.servicios, v.productos, v.propina, v.comisionProductos, v.total].map(esc).join(","));
    const blob = new Blob(["\ufeff" + filas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `movimientos-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const visibles = useMemo(() => (pros || []).map((p) => ({ ...p, ventas: soloProductos ? p.ventas.filter((v) => v.productos > 0) : p.ventas })), [pros, soloProductos]);

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/40 p-0 sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-900 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <p className="text-lg font-bold text-brand-dark dark:text-gray-100">Detalle de movimientos · {MESES[month - 1]} {year}</p>
            <p className="text-xs text-brand-gray">Cada venta del mes y cómo se usa para pagar a cada profesional. Solo lectura: aquí no se cambia nada.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 text-brand-gray hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3 text-sm dark:border-gray-800">
          <label className="flex items-center gap-2 text-brand-dark dark:text-gray-200">
            <input type="checkbox" checked={soloProductos} onChange={(e) => setSoloProductos(e.target.checked)} className="h-4 w-4" />
            Solo ventas que incluyen productos
          </label>
          <button type="button" onClick={descargar} disabled={!pros} className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-brand-dark disabled:opacity-50 dark:border-gray-700 dark:text-gray-100">
            <Download className="h-3.5 w-3.5" /> Descargar (Excel/CSV)
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {!pros && !error && <Spinner />}
          {pros && pros.length === 0 && <p className="py-8 text-center text-sm text-brand-gray">No hay profesionales en esta modalidad.</p>}
          {visibles.map((p) => (
            <section key={p.barberId} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-bold text-brand-dark dark:text-gray-100">{p.name}</h3>
                <p className="text-xs text-brand-gray">{p.resumen.ventas} ventas en el mes</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Cifra t="Servicios" v={p.resumen.servicios} nota={mode === "commission" ? `base de su ${p.rate}%` : undefined} />
                <Cifra t="Productos" v={p.resumen.productos} nota="no van al profesional" ambar={p.resumen.productos > 0} />
                <Cifra t="Propinas" v={p.resumen.propinas} nota="100% para el profesional" />
                <Cifra t="Comisión por productos" v={p.resumen.comisionProductos} nota="solo cosméticos" ambar={p.resumen.comisionProductos > 0} />
              </div>
              {mode === "commission" && p.resumen.comisionServicios !== null && (
                <p className="text-xs text-brand-gray">Comisión sobre servicios: <b>{formatCurrency(p.resumen.comisionServicios)}</b> ({p.rate}% de {formatCurrency(p.resumen.servicios)}).</p>
              )}
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-gray-50 text-brand-gray dark:bg-gray-800">
                    <tr><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Qué se vendió</th><th className="px-3 py-2">Pago</th><th className="px-3 py-2 text-right">Propina</th><th className="px-3 py-2 text-right">Total</th></tr>
                  </thead>
                  <tbody>
                    {p.ventas.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-brand-gray">Sin ventas.</td></tr>}
                    {p.ventas.map((v) => (
                      <tr key={v.id} className={`border-t border-gray-100 align-top dark:border-gray-800 ${v.productos > 0 ? "bg-amber-50/60 dark:bg-amber-900/10" : ""}`}>
                        <td className="whitespace-nowrap px-3 py-2">{v.fecha}</td>
                        <td className="px-3 py-2">{v.cliente}</td>
                        <td className="px-3 py-2">
                          {v.items.length === 0 ? <span className="text-brand-gray">(sin detalle)</span> : v.items.map((i, k) => (
                            <div key={k}>
                              {i.cantidad > 1 ? `${i.cantidad}× ` : ""}{i.nombre}
                              {i.tipo === "producto" && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">PRODUCTO{i.comisionProducto > 0 ? ` · comisión ${formatCurrency(i.comisionProducto)}` : " · no va al profesional"}</span>}
                              <span className="ml-1 text-brand-gray">{formatCurrency(i.total)}</span>
                            </div>
                          ))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{medio(v.medio)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{v.propina > 0 ? formatCurrency(v.propina) : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{formatCurrency(v.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Cifra({ t, v, nota, ambar }: { t: string; v: number; nota?: string; ambar?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${ambar ? "border-amber-200 bg-amber-50 dark:bg-amber-900/10" : "border-gray-100 dark:border-gray-800"}`}>
      <p className="text-[11px] text-brand-gray">{t}</p>
      <p className="text-base font-extrabold tabular-nums text-brand-dark dark:text-gray-100">{formatCurrency(v)}</p>
      {nota && <p className="text-[10px] text-brand-gray">{nota}</p>}
    </div>
  );
}

export function BotonDetalleMovimientos({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-xl border border-brand-blue/40 bg-white px-4 py-2 text-sm font-semibold text-brand-blue hover:bg-brand-blue/5 dark:bg-gray-900">
      <ListChecks className="h-4 w-4" /> Ver todos los detalles de los movimientos
    </button>
  );
}
