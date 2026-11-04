"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";

// Comisión por venta de cosméticos: monto fijo por unidad que gana el profesional. Cada negocio define el suyo (0 = no paga).
export function ComisionCosmeticosCard({ tenantId }: { tenantId: string }) {
  const { showToast } = useToast();
  const [valor, setValor] = useState<string>("");
  const [guardado, setGuardado] = useState<number | null>(null);
  const [faltaMigracion, setFaltaMigracion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [desde, setDesde] = useState("");
  const [desdeGuardado, setDesdeGuardado] = useState("");
  const [sinDesde, setSinDesde] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/settings/comision-cosmeticos?tenantId=${tenantId}`, { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d?.error) return;
      setFaltaMigracion(!!d.migrationMissing);
      setGuardado(Number(d.amount) || 0);
      setValor(String(Number(d.amount) || 0));
      setDesde(d.from || ""); setDesdeGuardado(d.from || ""); setSinDesde(!!d.fromMissing);
    }).catch(() => {});
  }, [tenantId]);

  if (guardado === null) return null;
  const numero = Number(valor);
  const valido = valor !== "" && Number.isInteger(numero) && numero >= 0 && numero <= 1_000_000;

  const guardar = async () => {
    if (!valido || guardando) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/settings/comision-cosmeticos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, amount: numero, ...(sinDesde ? {} : { from: desde || null }) }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d?.error || "No se pudo guardar", "error"); return; }
      setGuardado(numero); setDesdeGuardado(desde);
      showToast("Comisión por cosméticos guardada", "success");
    } finally { setGuardando(false); }
  };

  return (
    <div className="bg-white dark:bg-brand-white rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 p-4 md:p-6 space-y-3">
      <div>
        <h2 className="font-bold text-brand-dark">Comisión por venta de cosméticos</h2>
        <p className="text-xs text-brand-gray">Lo que gana el profesional por cada cosmético que vende. Los demás productos (consumibles, bebidas, aseo…) nunca le suman.</p>
      </div>
      {faltaMigracion ? (
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Falta una actualización de la base de datos (migración 122) para poder usarlo.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-brand-dark">$</span>
            <input type="number" min={0} max={1000000} step={100} inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} onFocus={(e) => e.currentTarget.select()}
              aria-label="Monto por cosmético vendido" className="h-10 w-32 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-brand-dark outline-none focus:border-brand-blue dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            <span className="text-xs text-brand-gray">por unidad vendida</span>
            <button type="button" onClick={guardar} disabled={!valido || guardando || (numero === guardado && desde === desdeGuardado)} className="ml-auto rounded-xl bg-brand-blue px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{guardando ? "Guardando…" : "Guardar"}</button>
          </div>
          {!sinDesde && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-brand-dark">Pagar desde</span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Pagar la comisión desde esta fecha" className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs text-brand-dark outline-none focus:border-brand-blue dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              <button type="button" onClick={() => setDesde("")} className="text-[11px] text-brand-gray underline">sin fecha (todas las ventas)</button>
            </div>
          )}
          <p className="text-[11px] text-brand-gray">Solo la ganan los profesionales con pago por comisión (no los de arriendo).</p>
          <p className="text-[11px] text-brand-gray">{guardado === 0 ? "Hoy este negocio no paga comisión por cosméticos." : `Hoy: ${formatCurrency(guardado)} por cada cosmético vendido. Un producto puede tener su propia comisión en Inventario.`} Con «Pagar desde», los meses anteriores a esa fecha no cambian.</p>
        </>
      )}
    </div>
  );
}
