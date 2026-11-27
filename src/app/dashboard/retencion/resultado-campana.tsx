"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";

interface Resultado { cupon: string; desde: string | null; enviados: number; reservas: number; confirmadas: number; atendidas: number; canceladas: number; volvieron: number; ventas: number; cobrado: number; descuento: number; maxUsos: number | null; usos: number }

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

// Cómo va la campaña: del correo a la reserva y al cobro. Se actualiza sola cada minuto.
export function ResultadoCampana({ cupon, tenantId, refrescar }: { cupon: string; tenantId?: string; refrescar: number }) {
  const [r, setR] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(false);
  const cargar = useCallback(() => {
    setCargando(true);
    const q = new URLSearchParams({ ...(cupon ? { cupon } : {}), ...(tenantId ? { tenantId } : {}) });
    fetch(`/api/retention/resultados?${q}`).then((x) => (x.ok ? x.json() : null)).then((d) => { if (d) setR(d.resultado); }).catch(() => {}).finally(() => setCargando(false));
  }, [cupon, tenantId]);
  useEffect(() => { cargar(); const t = setInterval(cargar, 60_000); return () => clearInterval(t); }, [cargar, refrescar]);
  if (!r) return null;
  const pct = r.enviados ? (r.volvieron / r.enviados) * 100 : 0;
  const dato = (titulo: string, valor: string | number, nota: string, fuerte = false) => (
    <div className={`rounded-xl border p-3 ${fuerte ? "border-brand-blue/40 bg-brand-blue/5" : "border-gray-100"}`}>
      <p className="text-[11px] font-semibold text-brand-gray">{titulo}</p>
      <p className="text-xl font-extrabold tabular-nums text-brand-dark">{valor}</p>
      <p className="text-[11px] text-brand-gray">{nota}</p>
    </div>
  );
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-brand-dark"><TrendingUp className="h-4 w-4 text-brand-blue" /> Resultado de la campaña · {r.cupon}</h2>
        <button type="button" onClick={cargar} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue"><RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} /> Actualizar</button>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {dato("Recibieron el correo", r.enviados.toLocaleString("es-CL"), "personas distintas")}
        {dato("Reservas con el cupón", r.reservas, `${r.confirmadas} confirmadas · ${r.canceladas} canceladas`, true)}
        {dato("Atendidas", r.atendidas, `${r.usos}${r.maxUsos ? ` de ${r.maxUsos}` : ""} usos cobrados`)}
        {dato("Cobrado con el cupón", pesos(r.cobrado), `${r.ventas} ventas · ${pesos(r.descuento)} de descuento`)}
        {dato("Volvieron a reservar", r.volvieron, `${pct.toFixed(1).replace(".", ",")}% de quienes lo recibieron (con o sin cupón)`)}
      </div>
    </div>
  );
}
