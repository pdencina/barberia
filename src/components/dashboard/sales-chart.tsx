"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { marcasEje, montoCorto, resumenPeriodo } from "@/lib/dashboard-format";

export type ChartRange = "7d" | "1m" | "3m" | "12m";

export interface ChartPoint {
  label: string;
  date: string;
  total: number;
  prev?: number; // mismo balde del período anterior (línea punteada)
}

interface SalesChartProps {
  data: ChartPoint[];
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  total: number;
  growth: number;
  loading?: boolean;
}

const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: "7d", label: "7 días" },
  { value: "1m", label: "1 mes" },
  { value: "3m", label: "3 meses" },
  { value: "12m", label: "12 meses" },
];

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Nombre completo del punto para el cuadro flotante: «vie 20 nov», «semana del 14 nov» o «noviembre 2026».
function nombrePunto(date: string, range: ChartRange): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y) return date;
  if (range === "12m") return `${MESES_LARGO[m - 1]} ${y}`;
  const dia = `${d} ${MESES[m - 1]}`;
  if (range === "3m") return `semana del ${dia}`;
  return `${DIAS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()]} ${dia}`;
}

const AZUL = "hsl(var(--brand-blue))";

// Gráfico de ventas de área: eje con montos legibles, comparación con el período anterior (línea punteada),
// resumen arriba (total, variación, promedio y mejor día) y cuadro flotante al pasar el mouse o tocar.
export function SalesChart({ data, range, onRangeChange, total, growth, loading }: SalesChartProps) {
  const cajaRef = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = cajaRef.current;
    if (!el) return;
    const medir = () => setAncho(Math.max(240, Math.floor(el.clientWidth)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  const res = useMemo(() => resumenPeriodo(data), [data]);
  const prevTotal = useMemo(() => data.reduce((s, d) => s + (d.prev || 0), 0), [data]);
  const hayPrev = prevTotal > 0;
  const positivo = growth >= 0;
  const vacio = data.length === 0 || data.every((d) => d.total === 0);

  const alto = ancho < 420 ? 190 : 240;
  const m = { l: 58, r: 12, t: 12, b: 26 };
  const w = ancho - m.l - m.r, h = alto - m.t - m.b;
  const maxDato = Math.max(...data.map((d) => Math.max(d.total, d.prev || 0)), 1);
  const marcas = marcasEje(maxDato, ancho < 420 ? 3 : 4);
  const tope = marcas[marcas.length - 1] || 1;
  const x = (i: number) => m.l + (data.length <= 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v: number) => m.t + h - (v / tope) * h;

  // Curva suave (Catmull-Rom → Bézier) para que se lea como tendencia y no como una quebrada.
  const trazo = (vals: number[]) => {
    if (vals.length === 0) return "";
    const pts = vals.map((v, i) => [x(i), y(v)] as const);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const clamp = (v: number) => Math.min(Math.max(v, m.t), m.t + h);
      d += ` C${c1x},${clamp(p1[1] + (p2[1] - p0[1]) / 6)} ${c2x},${clamp(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]},${p2[1]}`;
    }
    return d;
  };
  const lineaVentas = trazo(data.map((d) => d.total));
  const lineaPrev = hayPrev ? trazo(data.map((d) => d.prev || 0)) : "";
  const area = data.length > 1 ? `${lineaVentas} L${x(data.length - 1)},${m.t + h} L${x(0)},${m.t + h} Z` : "";
  const pasoEtiqueta = Math.max(1, Math.ceil(data.length / (ancho < 420 ? 5 : 9)));
  const conPuntos = data.length <= 14;

  const mover = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - m.l) / (w || 1)) * (data.length - 1));
    setHover(Math.min(Math.max(i, 0), data.length - 1));
  };
  const punto = hover !== null ? data[hover] : null;
  const difHover = punto && punto.prev ? Math.round(((punto.total - punto.prev) / punto.prev) * 100) : null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3.5 dark:border-white/10 dark:bg-brand-white md:p-6">
      {/* Resumen */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" />
            <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-brand-dark">Ventas</h3>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-brand-dark tabular-nums md:text-3xl">{formatCurrency(total)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className={cn("rounded-full px-2 py-0.5 font-semibold tabular-nums", positivo ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400")}>
              {positivo ? "▲" : "▼"} {Math.abs(growth)}%
            </span>
            <span className="text-brand-gray">vs período anterior{hayPrev ? ` (${montoCorto(prevTotal)})` : ""}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-2xl border border-gray-100 bg-brand-light p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => onRangeChange(opt.value)}
              className={cn("rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-200", range === opt.value ? "bg-brand-blue text-white shadow-md shadow-brand-blue/25" : "text-brand-gray hover:text-brand-dark")}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Datos clave del período */}
      {!vacio && (
        <div className="mt-4 grid grid-cols-2 gap-2 md:gap-3">
          <div className="rounded-xl bg-brand-light/70 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray">Promedio {range === "12m" ? "por mes" : range === "3m" ? "por semana" : "por día"}</p>
            <p className="text-sm font-bold text-brand-dark tabular-nums md:text-base">{formatCurrency(res.promedio)}</p>
          </div>
          <div className="rounded-xl bg-brand-light/70 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray">Mejor {range === "12m" ? "mes" : range === "3m" ? "semana" : "día"}</p>
            <p className="truncate text-sm font-bold text-brand-dark tabular-nums md:text-base">{res.mejor ? formatCurrency(res.mejor.total) : "—"}
              {res.mejor && <span className="ml-1.5 text-[11px] font-medium text-brand-gray">{nombrePunto(res.mejor.date, range)}</span>}</p>
          </div>
        </div>
      )}

      {/* Gráfico */}
      <div ref={cajaRef} className="relative mt-4">
        {loading ? (
          <div className="flex h-44 items-center justify-center text-sm text-brand-gray">Cargando...</div>
        ) : vacio ? (
          <div className="flex h-44 items-center justify-center text-sm text-brand-gray">Sin ventas en este período</div>
        ) : (
          <>
            <svg width={ancho} height={alto} role="img" aria-label="Gráfico de ventas del período" className="block select-none"
              style={{ touchAction: "pan-y" }} onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setHover(null)}>
              <defs>
                <linearGradient id="ventas-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: AZUL, stopOpacity: 0.3 }} />
                  <stop offset="100%" style={{ stopColor: AZUL, stopOpacity: 0.02 }} />
                </linearGradient>
              </defs>
              {/* Marcas y líneas guía */}
              {marcas.map((v) => (
                <g key={v}>
                  <line x1={m.l} x2={ancho - m.r} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-brand-gray" strokeOpacity={v === 0 ? 0.25 : 0.12} strokeDasharray={v === 0 ? undefined : "3 4"} />
                  <text x={m.l - 8} y={y(v) + 3.5} textAnchor="end" className="fill-brand-gray" style={{ fontSize: 10.5 }}>{montoCorto(v)}</text>
                </g>
              ))}
              {/* Etiquetas del eje horizontal */}
              {data.map((d, i) => (i % pasoEtiqueta === 0 || i === data.length - 1) && (
                <text key={d.date} x={x(i)} y={alto - 8} textAnchor={i === 0 && data.length > 1 ? "start" : i === data.length - 1 && data.length > 1 ? "end" : "middle"}
                  className={hover === i ? "fill-brand-blue" : "fill-brand-gray"} style={{ fontSize: 10.5, fontWeight: hover === i ? 700 : 500 }}>{d.label}</text>
              ))}
              {area && <path d={area} fill="url(#ventas-area)" />}
              {lineaPrev && <path d={lineaPrev} fill="none" stroke="currentColor" className="text-brand-gray" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="4 4" strokeLinecap="round" />}
              <path d={lineaVentas} fill="none" style={{ stroke: AZUL }} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              {conPuntos && data.map((d, i) => (
                <circle key={d.date} cx={x(i)} cy={y(d.total)} r={hover === i ? 5 : 3} style={{ stroke: AZUL }} className="fill-white" strokeWidth={2} />
              ))}
              {/* Punto marcado: línea vertical y círculo */}
              {punto && (
                <g>
                  <line x1={x(hover!)} x2={x(hover!)} y1={m.t} y2={m.t + h} style={{ stroke: AZUL }} strokeOpacity={0.35} strokeWidth={1} />
                  <circle cx={x(hover!)} cy={y(punto.total)} r={5.5} style={{ stroke: AZUL, fill: AZUL }} strokeWidth={2} fillOpacity={0.15} />
                  <circle cx={x(hover!)} cy={y(punto.total)} r={3} style={{ fill: AZUL }} />
                </g>
              )}
            </svg>
            {punto && (
              <div className="pointer-events-none absolute z-10 w-max max-w-[200px] -translate-x-1/2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10"
                style={{ left: Math.min(Math.max(x(hover!), 70), ancho - 70), top: 0 }}>
                <p className="font-semibold text-brand-dark first-letter:uppercase">{nombrePunto(punto.date, range)}</p>
                <p className="mt-0.5 text-sm font-extrabold tabular-nums text-brand-blue">{formatCurrency(punto.total)}</p>
                {hayPrev && (
                  <p className="mt-0.5 text-[11px] text-brand-gray tabular-nums">
                    Antes: {formatCurrency(punto.prev || 0)}{difHover !== null && <span className={difHover >= 0 ? " text-emerald-600" : " text-red-500"}> ({difHover >= 0 ? "+" : ""}{difHover}%)</span>}
                  </p>
                )}
              </div>
            )}
            {hayPrev && (
              <div className="mt-1 flex items-center justify-center gap-4 text-[11px] text-brand-gray">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: AZUL }} /> Este período</span>
                <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-brand-gray/60" /> Período anterior</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-2 text-right">
        <Link href="/dashboard/reportes" className="text-xs font-medium text-brand-blue hover:underline">Ver reportes →</Link>
      </div>
    </div>
  );
}
