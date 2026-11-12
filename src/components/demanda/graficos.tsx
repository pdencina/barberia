"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/premium";
import { DIAS, estaAbierta, etiquetaFila, type DemandMap, type Nivel } from "@/lib/demand-map";

const NIVEL_HEX: Record<Nivel, string> = { fuerte: "#10b981", normal: "#38bdf8", flojo: "#fbbf24" };
const NIVEL_TXT: Record<Nivel, string> = { fuerte: "Alta", normal: "Media", flojo: "Baja" };
const DIA_HEX = ["#0e8a8a", "#7c5cd6", "#38bdf8", "#f59e0b", "#f43f5e", "#10b981", "#94a3b8"];
const NOMBRE_DIA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
// Nombre corto de una fila en el eje: «10» por horas, «10–13» por bloques de trabajo.
const corto = (mapa: DemandMap, h: number) => (mapa.modo === "bloques" ? etiquetaFila(mapa, h).replace(/:00/g, "") : String(h));
const num = (n: number) => (n === 0 ? "0" : n < 10 ? n.toFixed(1).replace(".", ",") : String(Math.round(n)));

type Props = {
  mapa: DemandMap;
  dias: Map<number, { avg: number; nivel: Nivel | "cerrado" }>;
  horas: { hour: number; avg: number; nivel: Nivel }[];
  celda: Map<string, number>;
  descanso: number[];
};

// Marcas redondas del eje vertical.
function marcas(max: number): number[] {
  if (!(max > 0)) return [0, 1];
  const paso = [1, 2, 5, 10, 20, 25, 50, 100].find((p) => max / p <= 5) || 100;
  const out: number[] = [];
  for (let v = 0; v <= max + paso * 0.999; v += paso) out.push(v);
  return out;
}

// 1. Columnas: reservas por día, coloreadas por nivel de demanda.
function PorDia({ mapa, dias }: Pick<Props, "mapa" | "dias">) {
  const filas = mapa.porDia.filter((d) => dias.get(d.dow)?.nivel !== "cerrado");
  const ticks = marcas(Math.max(...filas.map((d) => d.avg), 1));
  const top = ticks[ticks.length - 1];
  const W = 520, H = 230, L = 34, R = 10, T = 18, B = 30;
  const iw = W - L - R, ih = H - T - B, bw = Math.min(46, iw / filas.length - 14);
  const y = (v: number) => T + ih - (v / top) * ih;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Reservas por día de la semana">
      {ticks.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-gray-200 dark:stroke-gray-700" strokeDasharray={t === 0 ? "0" : "3 4"} /><text x={L - 6} y={y(t) + 3.5} textAnchor="end" className="fill-brand-gray" style={{ fontSize: 10 }}>{t}</text></g>))}
      {filas.map((d, i) => {
        const n = dias.get(d.dow)!.nivel as Nivel;
        const cx = L + (iw / filas.length) * (i + 0.5);
        return (
          <g key={d.dow}>
            <title>{`${NOMBRE_DIA[d.dow - 1]}: ${num(d.avg)} reservas por semana · demanda ${NIVEL_TXT[n].toLowerCase()}`}</title>
            <rect x={cx - bw / 2} y={y(d.avg)} width={bw} height={Math.max(2, T + ih - y(d.avg))} rx={7} fill={NIVEL_HEX[n]} />
            <text x={cx} y={y(d.avg) - 5} textAnchor="middle" className="fill-brand-dark" style={{ fontSize: 11, fontWeight: 700 }}>{num(d.avg)}</text>
            <text x={cx} y={H - 10} textAnchor="middle" className="fill-brand-dark" style={{ fontSize: 11, fontWeight: 600 }}>{DIAS[d.dow - 1]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// 2. Área: reservas por hora del día, con el pico marcado.
function PorHora({ horas, descanso, mapa }: Pick<Props, "horas" | "descanso" | "mapa">) {
  const ticks = marcas(Math.max(...horas.map((h) => h.avg), 1));
  const top = ticks[ticks.length - 1];
  const W = 520, H = 230, L = 34, R = 14, T = 20, B = 30;
  const iw = W - L - R, ih = H - T - B;
  const x = (i: number) => L + (horas.length === 1 ? iw / 2 : (iw / (horas.length - 1)) * i);
  const y = (v: number) => T + ih - (v / top) * ih;
  const linea = horas.map((h, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(h.avg).toFixed(1)}`).join(" ");
  const area = `${linea} L${x(horas.length - 1).toFixed(1)},${T + ih} L${x(0).toFixed(1)},${T + ih} Z`;
  const pico = horas.reduce((m, h, i) => (h.avg > horas[m].avg ? i : m), 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Reservas por hora del día">
      <defs><linearGradient id="gr-hora" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0e8a8a" stopOpacity="0.35" /><stop offset="100%" stopColor="#0e8a8a" stopOpacity="0.02" /></linearGradient></defs>
      {ticks.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-gray-200 dark:stroke-gray-700" strokeDasharray={t === 0 ? "0" : "3 4"} /><text x={L - 6} y={y(t) + 3.5} textAnchor="end" className="fill-brand-gray" style={{ fontSize: 10 }}>{num(t)}</text></g>))}
      <path d={area} fill="url(#gr-hora)" />
      <path d={linea} fill="none" stroke="#0e8a8a" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {horas.map((h, i) => (
        <g key={h.hour} opacity={descanso.includes(h.hour) ? 0.35 : 1}>
          <title>{`${etiquetaFila(mapa, h.hour)}: ${num(h.avg)} reservas por semana · demanda ${NIVEL_TXT[h.nivel].toLowerCase()}${descanso.includes(h.hour) ? " (descanso)" : ""}`}</title>
          <circle cx={x(i)} cy={y(h.avg)} r={i === pico ? 6 : 4.5} fill={NIVEL_HEX[h.nivel]} stroke="#fff" strokeWidth={2} />
          <text x={x(i)} y={H - 10} textAnchor="middle" className="fill-brand-gray" style={{ fontSize: 10 }}>{corto(mapa, h.hour)}</text>
        </g>
      ))}
      <text x={x(pico)} y={y(horas[pico].avg) - 11} textAnchor="middle" className="fill-brand-dark" style={{ fontSize: 11, fontWeight: 700 }}>{`${etiquetaFila(mapa, horas[pico].hour)} · ${num(horas[pico].avg)}`}</text>
    </svg>
  );
}

// 3. Una línea por día a lo largo del horario: se ve en qué horas se llena cada día.
function LineasPorDia({ mapa, dias, celda }: Pick<Props, "mapa" | "dias" | "celda">) {
  const [resaltado, setResaltado] = useState<number | null>(null);
  const diasVisibles = mapa.porDia.filter((d) => dias.get(d.dow)?.nivel !== "cerrado").map((d) => d.dow);
  const valores = diasVisibles.flatMap((dow) => mapa.horas.map((h) => celda.get(`${dow}-${h}`) ?? 0));
  const ticks = marcas(Math.max(...valores, 1));
  const top = ticks[ticks.length - 1];
  const W = 760, H = 260, L = 34, R = 14, T = 14, B = 30;
  const iw = W - L - R, ih = H - T - B;
  const x = (i: number) => L + (mapa.horas.length === 1 ? iw / 2 : (iw / (mapa.horas.length - 1)) * i);
  const y = (v: number) => T + ih - (v / top) * ih;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {diasVisibles.map((dow) => (
          <button key={dow} type="button" onMouseEnter={() => setResaltado(dow)} onMouseLeave={() => setResaltado(null)} onClick={() => setResaltado(resaltado === dow ? null : dow)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-opacity ${resaltado !== null && resaltado !== dow ? "opacity-40" : ""} border-gray-200 text-brand-dark`}>
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: DIA_HEX[dow - 1] }} />{DIAS[dow - 1]}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Reservas por hora, una línea por día">
        {ticks.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-gray-200 dark:stroke-gray-700" strokeDasharray={t === 0 ? "0" : "3 4"} /><text x={L - 6} y={y(t) + 3.5} textAnchor="end" className="fill-brand-gray" style={{ fontSize: 10 }}>{num(t)}</text></g>))}
        {mapa.horas.map((h, i) => <text key={h} x={x(i)} y={H - 10} textAnchor="middle" className="fill-brand-gray" style={{ fontSize: 10 }}>{corto(mapa, h)}</text>)}
        {diasVisibles.map((dow) => {
          // La línea solo existe en las horas en que ese día se atiende: fuera de su horario se corta (no cae a 0 como si fuera demanda baja).
          let previo = false;
          const d = mapa.horas.map((h, i) => { const ab = estaAbierta(mapa, dow, h); const seg = `${ab ? (previo ? "L" : "M") : ""}${ab ? `${x(i).toFixed(1)},${y(celda.get(`${dow}-${h}`) ?? 0).toFixed(1)}` : ""}`; previo = ab; return seg; }).join(" ");
          const apagado = resaltado !== null && resaltado !== dow;
          return (
            <g key={dow} opacity={apagado ? 0.15 : 1}>
              <title>{NOMBRE_DIA[dow - 1]}</title>
              <path d={d} fill="none" stroke={DIA_HEX[dow - 1]} strokeWidth={resaltado === dow ? 3.5 : 2.2} strokeLinejoin="round" strokeLinecap="round" />
              {mapa.horas.map((h, i) => estaAbierta(mapa, dow, h) && <circle key={h} cx={x(i)} cy={y(celda.get(`${dow}-${h}`) ?? 0)} r={resaltado === dow ? 4 : 2.6} fill={DIA_HEX[dow - 1]}><title>{`${NOMBRE_DIA[dow - 1]} ${etiquetaFila(mapa, h)}: ${num(celda.get(`${dow}-${h}`) ?? 0)} reservas por semana`}</title></circle>)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// 4. Dona: qué parte de las reservas cae en cada día.
function Reparto({ mapa, dias }: Pick<Props, "mapa" | "dias">) {
  const filas = mapa.porDia.filter((d) => dias.get(d.dow)?.nivel !== "cerrado");
  const total = filas.reduce((s, d) => s + d.avg, 0) || 1;
  const R = 62, C = 2 * Math.PI * R;
  let acum = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg viewBox="0 0 180 180" className="h-44 w-44 flex-shrink-0" role="img" aria-label="Reparto de reservas por día">
        <circle cx="90" cy="90" r={R} fill="none" className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="26" />
        {filas.map((d) => {
          const frac = d.avg / total, largo = Math.max(0, frac * C - 2);
          const el = (
            <circle key={d.dow} cx="90" cy="90" r={R} fill="none" stroke={DIA_HEX[d.dow - 1]} strokeWidth="26"
              strokeDasharray={`${largo} ${C - largo}`} strokeDashoffset={-acum * C} transform="rotate(-90 90 90)">
              <title>{`${NOMBRE_DIA[d.dow - 1]}: ${Math.round(frac * 100)}% de las reservas`}</title>
            </circle>
          );
          acum += frac;
          return el;
        })}
        <text x="90" y="86" textAnchor="middle" className="fill-brand-dark" style={{ fontSize: 24, fontWeight: 800 }}>{num(total)}</text>
        <text x="90" y="104" textAnchor="middle" className="fill-brand-gray" style={{ fontSize: 10 }}>por semana</text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {filas.map((d) => (
          <li key={d.dow} className="flex items-center gap-2">
            <i className="h-3 w-3 rounded-sm" style={{ background: DIA_HEX[d.dow - 1] }} />
            <span className="w-20 font-medium text-brand-dark">{NOMBRE_DIA[d.dow - 1][0].toUpperCase() + NOMBRE_DIA[d.dow - 1].slice(1)}</span>
            <b className="tabular-nums text-brand-dark">{Math.round((d.avg / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DemandaGraficos(p: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-brand-gray">
        {(["fuerte", "normal", "flojo"] as Nivel[]).map((n) => <span key={n} className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: NIVEL_HEX[n] }} />Demanda {NIVEL_TXT[n].toLowerCase()}</span>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Reservas por día" subtitle="Promedio por semana. Más alto = más reservas."><div className="px-2 pb-3"><PorDia mapa={p.mapa} dias={p.dias} /></div></Panel>
        <Panel title={p.mapa.modo === "bloques" ? "Reservas por bloque de trabajo" : "Reservas por hora"} subtitle="Promedio por semana, sumando todos los días."><div className="px-2 pb-3"><PorHora horas={p.horas} descanso={p.descanso} mapa={p.mapa} /></div></Panel>
      </div>
      <Panel title={p.mapa.modo === "bloques" ? "Cada día, bloque por bloque" : "Cada día, hora por hora"} subtitle={p.mapa.modo === "bloques" ? "Una línea por día: sube cuando ese bloque se llena. Toca un día para resaltarlo." : "Una línea por día: sube cuando esa hora se llena. Toca un día para resaltarlo."}><div className="px-3 pb-3"><LineasPorDia mapa={p.mapa} dias={p.dias} celda={p.celda} /></div></Panel>
      <Panel title="¿En qué día caen las reservas?" subtitle="Reparto del total semanal."><div className="px-3 pb-4"><Reparto mapa={p.mapa} dias={p.dias} /></div></Panel>
    </div>
  );
}
