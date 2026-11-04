"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, Panel } from "@/components/ui/premium";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { ETIQUETA_ESTADO, type EstadoAbono } from "@/lib/abonos";

interface Item { paymentId: string; monto: number; estado: EstadoAbono; detalle: string; pagador: string | null; fecha: string; cita: null | { id: string; fecha: string; hora: string; estado: string; cliente: string | null; profesional: string | null } }
interface Datos { items: Item[]; totales: { recibido: number; por_devolver: number; devuelto: number; intentosNoAprobados: number }; migrationMissing?: boolean }
const COLOR: Record<EstadoAbono, string> = { recibido: "bg-emerald-100 text-emerald-700", por_devolver: "bg-amber-100 text-amber-800", devuelto: "bg-gray-100 text-gray-600", no_aprobado: "bg-red-50 text-red-600" };
const fecha = (iso: string) => new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)).replace(",", "");
const dmy = (f: string) => f.split("-").reverse().join("/");

// Abonos recibidos al reservar con Mercado Pago, y devolución del abono (solo administrador).
export default function AbonosPage() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const esAdmin = role === "admin" || role === "super_admin";
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [devolver, setDevolver] = useState<Item | null>(null);
  const [cancelar, setCancelar] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [verIntentos, setVerIntentos] = useState(false);

  const cargar = useCallback(() => {
    fetch("/api/abonos", { cache: "no-store" }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) setError(j?.error || "No se pudieron cargar"); else setD(j); }).catch(() => setError("No se pudieron cargar"));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const confirmarDevolucion = async () => {
    if (!devolver) return;
    setProcesando(true);
    try {
      const res = await fetch("/api/abonos/devolver", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: devolver.paymentId, cancelarCita: cancelar }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(j?.error || "No se pudo devolver", "error"); return; }
      showToast(j.citaCancelada ? "Abono devuelto y cita cancelada" : "Abono devuelto", "success");
      setDevolver(null); setCancelar(false); cargar();
    } finally { setProcesando(false); }
  };

  const visibles = (d?.items || []).filter((i) => verIntentos || i.estado !== "no_aprobado");
  return (
    <div className="p-3 md:p-6 space-y-4 max-w-5xl animate-fade-in">
      <PageHeader title="Abonos" subtitle="Lo que tus clientes pagaron al reservar con Mercado Pago" />
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {d?.migrationMissing && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Falta una actualización de la base de datos (migración 131).</p>}
      {!d && !error && <Spinner />}
      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-700">Recibido</p><p className="mt-1 text-2xl font-extrabold text-brand-dark">{formatCurrency(d.totales.recibido)}</p></div>
            <div className={`rounded-2xl border p-4 ${d.totales.por_devolver > 0 ? "border-amber-300 bg-amber-50" : "border-gray-100 bg-white"}`}><p className="text-xs font-semibold text-amber-700">Por devolver</p><p className="mt-1 text-2xl font-extrabold text-brand-dark">{formatCurrency(d.totales.por_devolver)}</p><p className="text-[11px] text-brand-gray">Pagos cuyo horario se ocupó antes</p></div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4"><p className="text-xs font-semibold text-brand-gray">Devuelto</p><p className="mt-1 text-2xl font-extrabold text-brand-dark">{formatCurrency(d.totales.devuelto)}</p></div>
          </div>

          <Panel title="Abonos" subtitle="El dinero llega a tu cuenta de Mercado Pago. Aquí solo ves el registro y puedes devolverlo.">
            {visibles.length === 0 ? <p className="py-6 text-center text-sm text-brand-gray">Todavía no hay abonos.</p> : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {visibles.map((i) => (
                  <div key={i.paymentId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-dark">{i.cita?.cliente || i.pagador || "Cliente"} <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${COLOR[i.estado]}`}>{ETIQUETA_ESTADO[i.estado]}</span></p>
                      <p className="text-xs text-brand-gray">{i.cita ? <>Cita {dmy(i.cita.fecha)} {i.cita.hora} · {i.cita.profesional || "—"}{i.cita.estado === "cancelled" ? " · cancelada" : ""}</> : i.estado === "no_aprobado" ? <span title={i.detalle}>Intento sin aprobar ({i.detalle.replace(/^.*?:/, "").replace(/_/g, " ")})</span> : "Sin cita asociada"} · pagado {fecha(i.fecha)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold tabular-nums text-brand-dark">{formatCurrency(i.monto)}</span>
                      {esAdmin && (i.estado === "recibido" || i.estado === "por_devolver") && <button type="button" onClick={() => { setDevolver(i); setCancelar(i.estado === "por_devolver"); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-brand-dark hover:bg-gray-50 dark:border-gray-700">Devolver</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {d.totales.intentosNoAprobados > 0 && <button type="button" onClick={() => setVerIntentos((v) => !v)} className="mt-3 text-[11px] text-brand-blue underline">{verIntentos ? "Ocultar" : "Mostrar"} {d.totales.intentosNoAprobados} intento{d.totales.intentosNoAprobados === 1 ? "" : "s"} de pago sin aprobar</button>}
          </Panel>
        </>
      )}

      {devolver && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => !procesando && setDevolver(null)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-brand-dark dark:text-gray-100">Devolver {formatCurrency(devolver.monto)}</h2>
            <p className="text-sm text-brand-gray">Se devuelve el abono completo a {devolver.cita?.cliente || devolver.pagador || "la clienta"} desde tu cuenta de Mercado Pago. No se puede deshacer.</p>
            {devolver.cita && devolver.cita.estado !== "cancelled" && (
              <label className="flex cursor-pointer items-start gap-2 text-sm text-brand-dark dark:text-gray-200"><input type="checkbox" checked={cancelar} onChange={(e) => setCancelar(e.target.checked)} className="mt-0.5 h-4 w-4" /><span>Cancelar también la cita del {dmy(devolver.cita.fecha)} a las {devolver.cita.hora} (el horario queda libre)</span></label>
            )}
            <div className="flex gap-2">
              <button type="button" disabled={procesando} onClick={() => setDevolver(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-brand-gray dark:border-gray-700">Cancelar</button>
              <button type="button" disabled={procesando} onClick={confirmarDevolucion} className="flex-1 rounded-xl bg-brand-blue py-2.5 text-sm font-semibold text-white disabled:opacity-50">{procesando ? "Devolviendo…" : "Devolver abono"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
