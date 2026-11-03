"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, Panel, Segmented, inputClass } from "@/components/ui/premium";
import { Spinner } from "@/components/ui/spinner";
import { DIAS, horariosFlojos, type DemandMap } from "@/lib/demand-map";

const NOMBRE_DIA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const num = (n: number) => (n === 0 ? "0" : n < 10 ? n.toFixed(1).replace(".", ",") : String(Math.round(n)));

// Mapa de demanda: cuándo se agenda más y cuándo menos, para cubrir los horarios bajos con promociones. Solo lectura.
export default function DemandaPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const [weeks, setWeeks] = useState<"4" | "8" | "12">("8");
  const [barberId, setBarberId] = useState("");
  const [equipo, setEquipo] = useState<{ id: string; name: string }[]>([]);
  const [mapa, setMapa] = useState<DemandMap | null>(null);
  const [error, setError] = useState("");
  const [descanso, setDescanso] = useState<number[]>([]);

  useEffect(() => { try { const g = JSON.parse(localStorage.getItem("demanda-descanso") || "[]"); if (Array.isArray(g)) setDescanso(g.filter((x) => Number.isInteger(x))); } catch {} }, []);
  const alternarDescanso = (h: number) => setDescanso((d) => { const n = d.includes(h) ? d.filter((x) => x !== h) : [...d, h]; try { localStorage.setItem("demanda-descanso", JSON.stringify(n)); } catch {} return n; });

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/barberos", { cache: "no-store" }).then((r) => r.json()).then((d) => setEquipo(Array.isArray(d) ? d.filter((m: any) => m?.id && m?.name).map((m: any) => ({ id: m.id, name: m.name })) : [])).catch(() => {});
  }, [isAdmin]);
  useEffect(() => {
    if (!isAdmin) return;
    setMapa(null); setError("");
    fetch(`/api/reportes/demanda?weeks=${weeks}${barberId ? `&barberId=${barberId}` : ""}`, { cache: "no-store" })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) setError(d?.error || "No se pudo cargar"); else setMapa(d); })
      .catch(() => setError("No se pudo cargar"));
  }, [isAdmin, weeks, barberId]);

  const celda = useMemo(() => new Map((mapa?.cells || []).map((c) => [`${c.dow}-${c.hour}`, c.avg])), [mapa]);
  const max = useMemo(() => Math.max(1, ...(mapa?.cells || []).map((c) => c.avg)), [mapa]);
  const flojos = useMemo(() => (mapa ? horariosFlojos(mapa, descanso) : []), [mapa, descanso]);
  const esFloja = (dow: number, h: number) => flojos.some((f) => f.dow === dow && f.hour === h);

  if (!isAdmin) return <div className="p-6 text-sm text-brand-gray">Solo el administrador puede ver esta sección.</div>;

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-5xl animate-fade-in">
      <PageHeader title="Mapa de demanda" subtitle="Cuándo se agenda más y cuándo menos, para cubrir los horarios bajos con promociones" />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={weeks} onChange={setWeeks} options={[{ value: "4", label: "4 semanas" }, { value: "8", label: "8 semanas" }, { value: "12", label: "12 semanas" }]} />
        <select value={barberId} onChange={(e) => setBarberId(e.target.value)} className={`${inputClass} max-w-[220px]`}>
          <option value="">Todo el equipo</option>
          {equipo.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {!mapa && !error && <Spinner />}

      {mapa && mapa.totalReservas === 0 && <p className="py-8 text-center text-sm text-brand-gray">Aún no hay reservas en este período.</p>}

      {mapa && mapa.totalReservas > 0 && (
        <>
          <Panel title="Reservas promedio por semana" subtitle={`${mapa.desde.split("-").reverse().join("/")} al ${mapa.hasta.split("-").reverse().join("/")} · ${mapa.totalReservas} reservas (sin canceladas). Más oscuro = más demanda. Borde ámbar = de los horarios más flojos.`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-separate border-spacing-1 text-center text-xs">
                <thead>
                  <tr>
                    <th className="w-14" />
                    {DIAS.map((d, i) => { const t = mapa.porDia[i]; return <th key={d} className="pb-1 font-semibold text-brand-dark">{d}<div className="text-[10px] font-normal text-brand-gray">{num(t.avg)}/sem</div></th>; })}
                  </tr>
                </thead>
                <tbody>
                  {mapa.horas.map((h) => (
                    <tr key={h}>
                      <th className="pr-1 text-right font-medium text-brand-gray">
                        <button type="button" onClick={() => alternarDescanso(h)} title={descanso.includes(h) ? "Marcada como descanso: no cuenta como horario flojo. Toca para quitarla" : "Toca para marcar esta hora como descanso (ej. almuerzo)"} className={descanso.includes(h) ? "line-through opacity-60" : ""}>{hh(h)}</button>
                      </th>
                      {DIAS.map((_, i) => {
                        const dow = i + 1, v = celda.get(`${dow}-${h}`) ?? 0, r = v / max;
                        return (
                          <td key={dow} title={`${NOMBRE_DIA[i]} ${hh(h)}: ${num(v)} reservas por semana`}
                            style={{ background: v === 0 ? undefined : `rgba(13,148,136,${0.1 + r * 0.8})`, color: r > 0.55 ? "#fff" : undefined }}
                            className={`h-9 rounded-lg ${v === 0 ? "bg-gray-50 text-gray-300 dark:bg-gray-800" : "font-semibold"} ${esFloja(dow, h) ? "ring-2 ring-amber-400" : ""} ${descanso.includes(h) ? "opacity-40" : ""}`}>
                            {num(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-brand-gray">Consejo: toca una hora (ej. 14:00) para marcarla como descanso del equipo; deja de contarse como horario flojo. Se guarda en este navegador.</p>
          </Panel>

          <Panel title="Horarios más flojos" subtitle="Los mejores candidatos para una promoción. Solo dentro del horario en que cada día sí se atiende.">
            <ol className="divide-y divide-gray-100 dark:divide-gray-800">
              {flojos.map((f, i) => (
                <li key={`${f.dow}-${f.hour}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-brand-dark"><b className="text-brand-gray">{i + 1}.</b> {NOMBRE_DIA[f.dow - 1]} a las {hh(f.hour)}</span>
                  <span className="text-xs text-brand-gray">{num(f.avg)} reservas por semana</span>
                </li>
              ))}
              {flojos.length === 0 && <li className="py-3 text-sm text-brand-gray">No hay horarios flojos con los datos de este período.</li>}
            </ol>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link href="/dashboard/cupones" className="inline-flex items-center rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white">Crear una promoción (Cupones)</Link>
              <span className="text-[11px] text-brand-gray">Los cupones aún no se limitan por día y hora; por ahora úsalos en la comunicación («válido de lunes a miércoles»).</span>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
