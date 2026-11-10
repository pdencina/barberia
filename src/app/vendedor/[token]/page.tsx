"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Datos = { nombre: string; stats: { iniciados: number; pagados: number; ingresos: number; conversion: number; ventas: { fecha: string | null; plan: string | null; monto: number }[] } };
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

export default function VendedorPage() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/vendedor?t=${encodeURIComponent(String(token))}`, { cache: "no-store" })
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) setError(j.error || "No se pudo cargar"); else setD(j); })
      .catch(() => setError("No se pudo cargar"));
  }, [token]);

  return (
    <div className="min-h-screen bg-brand-light p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="pt-4 text-center">
          <img src="/logo-icon.png" alt="re-booking" className="mx-auto h-12 w-12" />
          <h1 className="mt-2 text-xl font-bold text-brand-dark">{d ? `Ventas de ${d.nombre}` : "Mis ventas"}</h1>
          <p className="text-xs text-brand-gray">Lo que has vendido con tu link de re-booking</p>
        </div>
        {error && <p className="rounded-xl bg-white p-4 text-center text-sm text-red-600">{error}</p>}
        {!d && !error && <p className="text-center text-sm text-brand-gray">Cargando...</p>}
        {d && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-gray-200 bg-white p-3"><p className="text-2xl font-bold text-brand-dark">{d.stats.iniciados}</p><p className="text-[11px] text-brand-gray">Empezaron a contratar</p></div>
              <div className="rounded-2xl border border-gray-200 bg-white p-3"><p className="text-2xl font-bold text-brand-dark">{d.stats.pagados}</p><p className="text-[11px] text-brand-gray">Pagaron</p></div>
              <div className="rounded-2xl border border-gray-200 bg-white p-3"><p className="text-2xl font-bold text-brand-dark">{d.stats.conversion}%</p><p className="text-[11px] text-brand-gray">Conversión</p></div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-xs text-brand-gray">Total del primer cobro de tus ventas</p>
              <p className="text-3xl font-bold text-brand-blue">{clp(d.stats.ingresos)}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="mb-2 text-sm font-semibold text-brand-dark">Tus ventas</p>
              {d.stats.ventas.length === 0 ? <p className="text-sm text-brand-gray">Todavía no hay ventas con tu link.</p> : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {d.stats.ventas.map((v, i) => (
                    <li key={i} className="flex justify-between py-2"><span className="text-brand-gray">{v.fecha || "-"} · {v.plan || "plan"}</span><span className="font-semibold text-brand-dark">{clp(v.monto)}</span></li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
