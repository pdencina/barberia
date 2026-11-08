"use client";

import { useEffect, useState } from "react";

type Row = { campaign: string; source: string; iniciados: number; pagados: number; ingresos: number; conversion: number };
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

export default function CampanasPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [migracion, setMigracion] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/superadmin/campanas").then((r) => r.json()).then((d) => {
      if (d.error) setError(d.error); else { setRows(d.campanas); setMigracion(d.migracion !== false); }
    }).catch(() => setError("No se pudo cargar"));
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-brand-dark">Campañas</h1>
      <p className="text-sm text-brand-gray mt-1">Qué anuncio trajo qué: cuántos empezaron a contratar re-booking, cuántos pagaron y cuánto dinero entró.</p>
      {!migracion && <p className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">Falta aplicar la migración 149: por ahora todo aparece como «directo».</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {!rows && !error && <p className="mt-4 text-sm text-brand-gray">Cargando...</p>}
      {rows && rows.length === 0 && <p className="mt-4 text-sm text-brand-gray">Todavía no hay altas.</p>}
      {rows && rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-brand-gray"><tr>
              <th className="p-3">Campaña</th><th className="p-3">Origen</th><th className="p-3 text-right">Empezaron</th><th className="p-3 text-right">Pagaron</th><th className="p-3 text-right">Conversión</th><th className="p-3 text-right">Ingresos</th>
            </tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.source + r.campaign} className="border-t border-gray-100">
                <td className="p-3 font-medium text-brand-dark">{r.campaign}</td><td className="p-3">{r.source}</td>
                <td className="p-3 text-right">{r.iniciados}</td><td className="p-3 text-right">{r.pagados}</td>
                <td className="p-3 text-right">{r.conversion}%</td><td className="p-3 text-right font-semibold">{clp(r.ingresos)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
