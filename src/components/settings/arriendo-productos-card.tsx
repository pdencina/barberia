"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";

// Productos (cosméticos) que vende un profesional de ARRIENDO: ¿el negocio los cobra? Cada negocio decide; apagado por defecto.
export function ArriendoProductosCard({ tenantId }: { tenantId: string }) {
  const { showToast } = useToast();
  const [modo, setModo] = useState<"off" | "business_collects" | null>(null);
  const [desde, setDesde] = useState("");
  const [tarjeta, setTarjeta] = useState(true);
  const [falta, setFalta] = useState(false);
  const [inicial, setInicial] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/settings/arriendo-productos?tenantId=${tenantId}`, { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d?.error) return;
      setFalta(!!d.migrationMissing); setModo(d.mode); setDesde(d.from || ""); setTarjeta(d.cardToBarber !== false);
      setInicial(JSON.stringify([d.mode, d.from || "", d.cardToBarber !== false]));
    }).catch(() => {});
  }, [tenantId]);

  if (modo === null) return null;
  const actual = JSON.stringify([modo, desde, tarjeta]);
  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch("/api/settings/arriendo-productos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, mode: modo, from: desde || null, cardToBarber: tarjeta }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d?.error || "No se pudo guardar", "error"); return; }
      setInicial(actual); showToast("Guardado", "success");
    } finally { setGuardando(false); }
  };
  const radio = "mt-0.5 h-4 w-4";
  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-white md:p-6">
      <div>
        <h2 className="font-bold text-brand-dark">Cosméticos vendidos por profesionales de arriendo</h2>
        <p className="text-xs text-brand-gray">Qué pasa a fin de mes cuando un profesional que paga arriendo de estación vende un cosmético en el Punto de Venta. Los de comisión no cambian: el dinero entra al negocio y ellos ganan su comisión.</p>
      </div>
      {falta ? <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Falta una actualización de la base de datos (migración 130) para poder usarlo.</p> : (
        <>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gray-100 p-3 text-sm">
            <input type="radio" name="modo-arr" checked={modo === "off"} onChange={() => setModo("off")} className={radio} />
            <span><b className="text-brand-dark">Solo comisión (como hasta ahora)</b><span className="block text-xs text-brand-gray">El producto no suma ni resta en su cierre del mes.</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gray-100 p-3 text-sm">
            <input type="radio" name="modo-arr" checked={modo === "business_collects"} onChange={() => setModo("business_collects")} className={radio} />
            <span><b className="text-brand-dark">El negocio cobra el producto</b>
              <span className="block text-xs text-brand-gray">El producto es del negocio. Si el dinero lo recibió el profesional, a fin de mes <b>paga el precio menos su comisión</b>. Si lo recibió el negocio (caja o su cuenta), el negocio le descuenta del arriendo <b>solo su comisión</b>. Solo cosméticos. El monto de la comisión se define en «Comisión por venta de cosméticos».</span></span>
          </label>
          {modo === "business_collects" && (
            <div className="space-y-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-900/40">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input type="checkbox" checked={tarjeta} onChange={(e) => setTarjeta(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span><b className="text-brand-dark">Débito y crédito van al profesional</b><span className="block text-xs text-brand-gray">Actívalo si cada profesional tiene su propia máquina. Si las tarjetas entran al negocio, desactívalo.</span></span>
              </label>
              <p className="text-xs text-brand-gray">El <b>efectivo</b> y la <b>transferencia</b> se configuran en la ficha de cada profesional de arriendo (si se los queda él o entran al negocio).</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-brand-dark">Aplicar desde</span>
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Aplicar desde esta fecha" className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs text-brand-dark outline-none focus:border-brand-blue dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                <button type="button" onClick={() => setDesde("")} className="text-[11px] text-brand-gray underline">sin fecha (todas las ventas)</button>
              </div>
            </div>
          )}
          <div className="flex justify-end"><button type="button" onClick={guardar} disabled={guardando || actual === inicial} className="rounded-xl bg-brand-blue px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{guardando ? "Guardando…" : "Guardar"}</button></div>
        </>
      )}
    </div>
  );
}
