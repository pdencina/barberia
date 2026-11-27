"use client";

import type { ResultadoPromo } from "@/lib/promo-resultados";

const VACIO: ResultadoPromo = { reservas: 0, atendidas: 0, anuladas: 0, ventas: 0, monto: 0, servicios: [], detalle: [] };

const ESTADOS: Record<string, string> = { scheduled: "Agendada", confirmed: "Confirmada", in_progress: "En atención", completed: "Atendida", cancelled: "Anulada", no_show: "No llegó" };

// Contador de la promoción elegida: cuántos servicios se tomaron, cuáles y cuánta plata dejaron.
export function ResultadosPromo({ dato, usos, maximo, onActualizar }: { dato?: ResultadoPromo; usos: number; maximo: number | null; onActualizar: () => void }) {
  const r = dato || VACIO;
  const total = r.servicios.reduce((n, s) => n + s.reservados, 0);
  const mayor = Math.max(1, ...r.servicios.map((s) => s.reservados));
  const cajas: Array<[string, string, string?]> = [
    ["Servicios reservados", String(total), `${r.reservas} reserva${r.reservas === 1 ? "" : "s"}`],
    ["Atendidas", String(r.atendidas), r.anuladas ? `${r.anuladas} anulada${r.anuladas === 1 ? "" : "s"}` : undefined],
    ["Cobrado", `$${Math.round(r.monto).toLocaleString("es-CL")}`, `${r.ventas} venta${r.ventas === 1 ? "" : "s"}`],
    ["Cupos usados", maximo ? `${usos} de ${maximo}` : String(usos), maximo ? `quedan ${Math.max(0, maximo - usos)}` : "sin límite"],
  ];
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" aria-label="Resultados de la promoción">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-brand-dark">Resultados</h2>
        <button type="button" onClick={onActualizar} className="text-xs font-semibold text-brand-blue hover:underline">Actualizar</button>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cajas.map(([t, v, d]) => (
          <div key={t} className="rounded-xl bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-brand-gray">{t}</p>
            <p className="text-xl font-bold text-brand-dark">{v}</p>
            {d && <p className="text-[11px] text-brand-gray">{d}</p>}
          </div>
        ))}
      </div>
      {r.servicios.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {r.servicios.map((s) => (
            <li key={s.nombre}>
              <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate text-brand-dark">{s.nombre}</span><span className="flex-shrink-0 text-xs text-brand-gray"><b className="text-brand-dark">{s.reservados}</b> reservado{s.reservados === 1 ? "" : "s"} · {s.atendidos} atendido{s.atendidos === 1 ? "" : "s"}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-brand-blue" style={{ width: `${(s.reservados / mayor) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-xs text-brand-gray">Todavía nadie ha reservado con este código.</p>}
      {(r.detalle || []).length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-bold text-brand-dark">Quiénes reservaron</h3>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {r.detalle.map((x) => {
              const cel = (x.telefono || "").replace(/\D/g, "");
              const junto = x.grupo ? r.detalle.find((y) => y.id !== x.id && y.grupo === x.grupo) : null;
              return (
                <li key={x.id} className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2.5 ${x.estado === "cancelled" ? "opacity-50" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-dark">{x.cliente}<span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-brand-gray">{ESTADOS[x.estado] || x.estado}</span></p>
                    <p className="break-all text-xs text-brand-gray">
                      {cel ? <a href={`https://wa.me/${cel.length === 9 ? `56${cel}` : cel}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-blue hover:underline">{x.telefono}</a> : "Sin celular"}
                      {x.correo ? ` · ${x.correo}` : ""}
                    </p>
                    {junto && <p className="text-[11px] text-brand-gray">Reservó junto con {junto.cliente}</p>}
                  </div>
                  <div className="text-right text-xs text-brand-gray">
                    <p className="font-semibold text-brand-dark">{x.fecha.split("-").reverse().join("/")} · {x.hora}</p>
                    <p>{x.servicios}</p>
                    <p>con {x.profesional}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
