"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, Panel, Segmented, inputClass } from "@/components/ui/premium";
import { Spinner } from "@/components/ui/spinner";
import { DIAS, horariosFlojos, nivelesPorDia, nivelesPorHora, nivelCelda, type DemandMap, type Nivel } from "@/lib/demand-map";

const NOMBRE_DIA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const num = (n: number) => (n === 0 ? "0" : n < 1 ? n.toFixed(2).replace(".", ",") : n < 10 ? n.toFixed(1).replace(".", ",") : String(Math.round(n)));
const lista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

const COLOR: Record<Nivel, { barra: string; celda: string; texto: string; etiqueta: string }> = {
  fuerte: { barra: "bg-emerald-500", celda: "bg-emerald-500 text-white", texto: "text-emerald-700", etiqueta: "Alta" },
  normal: { barra: "bg-sky-300", celda: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200", texto: "text-sky-700", etiqueta: "Media" },
  flojo: { barra: "bg-amber-400", celda: "bg-amber-200 text-amber-900", texto: "text-amber-700", etiqueta: "Baja" },
};

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
  const maxCelda = useMemo(() => Math.max(1, ...(mapa?.cells || []).map((c) => c.avg)), [mapa]);
  const dias = useMemo(() => (mapa ? nivelesPorDia(mapa) : new Map()), [mapa]);
  const horas = useMemo(() => (mapa ? nivelesPorHora(mapa) : []), [mapa]);
  const flojos = useMemo(() => (mapa ? horariosFlojos(mapa, descanso, 6) : []), [mapa, descanso]);
  const maxDia = Math.max(1, ...(mapa?.porDia.map((d) => d.avg) || [1]));
  const maxHora = Math.max(1, ...horas.map((h) => h.avg));

  const diasFlojos = mapa ? mapa.porDia.filter((d) => dias.get(d.dow)?.nivel === "flojo").map((d) => NOMBRE_DIA[d.dow - 1]) : [];
  const diaFuerte = mapa ? [...mapa.porDia].sort((a, b) => b.avg - a.avg)[0] : null;
  const horasFlojas = horas.filter((h) => h.nivel === "flojo" && !descanso.includes(h.hour)).map((h) => hh(h.hour));
  const horaFuerte = horas.length ? [...horas].sort((a, b) => b.avg - a.avg)[0] : null;

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
          {mapa.totalReservas / mapa.weeks < 15 && (
            <p className="rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs text-brand-gray">
              Hay pocas reservas en este período ({mapa.totalReservas} en {mapa.weeks} semanas), así que los números por hora son pequeños. {weeks !== "12" ? "Elige 12 semanas para ver patrones más claros." : "A medida que se agenden más citas, el mapa será más preciso."}
            </p>
          )}
          {/* 1. Lo importante, en palabras */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-700">Días de menor demanda</p>
              <p className="mt-1 text-lg font-bold text-brand-dark">{diasFlojos.length ? cap(lista(diasFlojos)) : "Sin días de baja demanda"}</p>
              <p className="text-xs text-brand-gray">Los días con menos reservas</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-700">Horas de menor demanda</p>
              <p className="mt-1 text-lg font-bold text-brand-dark">{horasFlojas.length ? lista(horasFlojas) : "Sin horas de baja demanda"}</p>
              <p className="text-xs text-brand-gray">En promedio, todos los días</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold text-emerald-700">Mayor demanda</p>
              <p className="mt-1 text-lg font-bold text-brand-dark">{diaFuerte ? cap(NOMBRE_DIA[diaFuerte.dow - 1]) : "—"}{horaFuerte ? ` · ${hh(horaFuerte.hour)}` : ""}</p>
              <p className="text-xs text-brand-gray">El día y la hora con más reservas</p>
            </div>
          </div>

          {/* 2. Gráficos de barras */}
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Reservas por día" subtitle="Promedio por semana">
              <div className="space-y-2">
                {mapa.porDia.filter((d) => dias.get(d.dow)?.nivel !== "cerrado").map((d) => {
                  const n = dias.get(d.dow)!.nivel as Nivel;
                  return (
                    <div key={d.dow} className="flex items-center gap-2 text-xs">
                      <span className="w-9 font-semibold text-brand-dark">{DIAS[d.dow - 1]}</span>
                      <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className={`h-full rounded-full ${COLOR[n].barra}`} style={{ width: `${Math.max(3, (d.avg / maxDia) * 100)}%` }} /></div>
                      <span className="w-8 text-right font-bold tabular-nums text-brand-dark">{num(d.avg)}</span>
                      <span className={`w-12 text-[11px] font-semibold ${COLOR[n].texto}`}>{COLOR[n].etiqueta}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
            <Panel title="Reservas por hora" subtitle="Promedio por semana, sumando todos los días. Toca una hora para marcarla como descanso.">
              <div className="space-y-1.5">
                {horas.map((h) => (
                  <button type="button" key={h.hour} onClick={() => alternarDescanso(h.hour)} title={descanso.includes(h.hour) ? "Marcada como descanso (no cuenta como demanda baja). Toca para quitarla" : "Toca para marcar como descanso del equipo"} className={`flex w-full items-center gap-2 text-left text-xs ${descanso.includes(h.hour) ? "opacity-40" : ""}`}>
                    <span className={`w-11 font-semibold text-brand-dark ${descanso.includes(h.hour) ? "line-through" : ""}`}>{hh(h.hour)}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className={`h-full rounded-full ${COLOR[h.nivel].barra}`} style={{ width: `${Math.max(3, (h.avg / maxHora) * 100)}%` }} /></div>
                    <span className="w-8 text-right font-bold tabular-nums text-brand-dark">{num(h.avg)}</span>
                  </button>
                ))}
              </div>
            </Panel>
          </div>

          {/* 3. Mapa de colores, sin números */}
          <Panel title="Día y hora, en colores" subtitle="Cada cuadro es un día a una hora. Pasa el cursor (o toca) para ver cuántas reservas por semana.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-separate border-spacing-1 text-center text-xs">
                <thead><tr><th className="w-12" />{DIAS.slice(0, 6).map((d) => <th key={d} className="pb-1 font-semibold text-brand-dark">{d}</th>)}</tr></thead>
                <tbody>
                  {mapa.horas.map((h) => (
                    <tr key={h}>
                      <th className={`pr-1 text-right font-medium text-brand-gray ${descanso.includes(h) ? "line-through opacity-50" : ""}`}>{hh(h)}</th>
                      {DIAS.slice(0, 6).map((_, i) => {
                        const dow = i + 1, v = celda.get(`${dow}-${h}`) ?? 0, n = nivelCelda(v, maxCelda);
                        const cerrado = dias.get(dow)?.nivel === "cerrado";
                        return <td key={dow} title={`${NOMBRE_DIA[i]} ${hh(h)}: ${num(v)} reservas por semana`} className={`h-8 rounded-md ${cerrado || descanso.includes(h) ? "bg-gray-100 dark:bg-gray-800" : COLOR[n].celda}`} />;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-brand-gray">
              {(["fuerte", "normal", "flojo"] as Nivel[]).map((n) => <span key={n} className="inline-flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded ${COLOR[n].barra}`} /> {COLOR[n].etiqueta}</span>)}
              <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gray-200" /> Descanso o sin atención</span>
            </div>
          </Panel>

          {/* 4. Qué hacer */}
          <Panel title="Dónde conviene promocionar" subtitle="Los horarios con menos reservas, dentro del horario en que cada día sí se atiende.">
            <ol className="divide-y divide-gray-100 dark:divide-gray-800">
              {flojos.map((f, i) => (
                <li key={`${f.dow}-${f.hour}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-brand-dark"><b className="text-brand-gray">{i + 1}.</b> {cap(NOMBRE_DIA[f.dow - 1])} a las {hh(f.hour)}</span>
                  <span className="text-xs text-brand-gray">{num(f.avg)} reservas por semana</span>
                </li>
              ))}
              {flojos.length === 0 && <li className="py-3 text-sm text-brand-gray">No hay horarios de baja demanda con los datos de este período.</li>}
            </ol>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link href="/dashboard/cupones" className="inline-flex items-center rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white">Crear una promoción (Cupones)</Link>
              <span className="text-[11px] text-brand-gray">Los cupones aún no se limitan por día y hora; por ahora úsalos en la comunicación («válido de lunes a miércoles»).</span>
            </div>
          </Panel>
          <p className="text-[11px] text-brand-gray">Período: {mapa.desde.split("-").reverse().join("/")} al {mapa.hasta.split("-").reverse().join("/")} · {mapa.totalReservas} reservas, sin contar canceladas. «Descanso» se guarda en este navegador.</p>
        </>
      )}
    </div>
  );
}
