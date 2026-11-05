"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { intensidades, marcasEje, montoCorto, resumenPeriodo, type Intensidad } from "@/lib/dashboard-format";

export type ChartRange = "7d" | "14d" | "1m" | "3m" | "12m";

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
  { value: "14d", label: "14 días" },
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

// Color de cada día según su fuerza: azul de la marca (más opacidad = más fuerte) o rojo suave (más opacidad = más lento).
const colorTono = (i: Intensidad) =>
  i.tono === "fuerte" ? `hsl(var(--brand-blue) / ${i.opacidad})`
  : i.tono === "lento" ? `rgb(220 60 60 / ${i.opacidad})`
  : i.tono === "normal" ? "rgb(148 163 184 / 0.22)" : "rgb(148 163 184 / 0.10)";
const ETIQUETA_NIVEL: Record<number, string> = { [-3]: "Muy lento", [-2]: "Lento", [-1]: "Algo lento", 0: "Normal", 1: "Bueno", 2: "Fuerte", 3: "Muy fuerte" };
const NOMBRE_DIA_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

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
  const porDia = range === "7d" || range === "14d" || range === "1m";
  const inten = useMemo(() => intensidades(data, porDia), [data, porDia]);
  const prevTotal = useMemo(() => data.reduce((s, d) => s + (d.prev || 0), 0), [data]);
  const hayPrev = prevTotal > 0;
  const positivo = growth >= 0;
  const vacio = data.length === 0 || data.every((d) => d.total === 0);

  const alto = ancho < 420 ? 200 : 250;
  const m = { l: 58, r: 12, t: 12, b: 26 };
  const w = ancho - m.l - m.r, h = alto - m.t - m.b;
  const maxDato = Math.max(...data.map((d) => Math.max(d.total, d.prev || 0)), 1);
  const marcas = marcasEje(maxDato, ancho < 420 ? 3 : 4);
  const tope = marcas[marcas.length - 1] || 1;
  const x = (i: number) => m.l + (data.length <= 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v: number) => m.t + h - (v / tope) * h;

  // Curva suave que NO se pasa de los datos (interpolación monótona): una caída de domingo no se convierte en una ola falsa.
  const trazo = (vals: number[]) => {
    const n = vals.length;
    if (n === 0) return "";
    const px = vals.map((_, i) => x(i)), py = vals.map((v) => y(v));
    if (n === 1) return `M${px[0]},${py[0]}`;
    const dx = px.slice(1).map((v, i) => v - px[i]);
    const sl = py.slice(1).map((v, i) => (v - py[i]) / dx[i]);
    const t = [sl[0]];
    for (let i = 1; i < n - 1; i++) t.push(sl[i - 1] * sl[i] <= 0 ? 0 : (sl[i - 1] + sl[i]) / 2);
    t.push(sl[n - 2]);
    for (let i = 0; i < n - 1; i++) {
      if (sl[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / sl[i], b = t[i + 1] / sl[i], h = Math.hypot(a, b);
      if (h > 3) { t[i] = (3 * a * sl[i]) / h; t[i + 1] = (3 * b * sl[i]) / h; }
    }
    let d = `M${px[0]},${py[0]}`;
    for (let i = 0; i < n - 1; i++) d += ` C${px[i] + dx[i] / 3},${py[i] + (t[i] * dx[i]) / 3} ${px[i + 1] - dx[i] / 3},${py[i + 1] - (t[i + 1] * dx[i]) / 3} ${px[i + 1]},${py[i + 1]}`;
    return d;
  };
  const lineaVentas = trazo(data.map((d) => d.total));
  const lineaPrev = hayPrev ? trazo(data.map((d) => d.prev || 0)) : "";
  const area = data.length > 1 ? `${lineaVentas} L${x(data.length - 1)},${m.t + h} L${x(0)},${m.t + h} Z` : "";
  // «Normal» del período = mediana de los puntos con ventas. Entre la curva y esa línea: azul si sube, rojo suave si baja.
  const conVentaOrden = data.filter((d) => d.total > 0).map((d) => d.total).sort((p, q) => p - q);
  const normal = conVentaOrden.length ? conVentaOrden[Math.floor(conVentaOrden.length / 2)] : 0;
  const yNormal = y(normal);
  const entreLinea = data.length > 1 ? `${lineaVentas} L${x(data.length - 1)},${yNormal} L${x(0)},${yNormal} Z` : "";
  const pasoEtiqueta = Math.max(1, Math.ceil(data.length / (ancho < 420 ? 5 : 9)));
  const conPuntos = data.length <= 14;
  const ultimo = data.length - 1;
  const etiquetaVisible = (i: number) => (ultimo - i) % pasoEtiqueta === 0; // desde el final: el último punto (hoy) siempre lleva etiqueta

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
        <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-gray-100 bg-brand-light p-1 sm:gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => onRangeChange(opt.value)}
              className={cn("rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 sm:px-3", range === opt.value ? "bg-brand-blue text-white shadow-md shadow-brand-blue/25" : "text-brand-gray hover:text-brand-dark")}>
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
            <p className="text-sm font-bold text-brand-dark tabular-nums md:text-base">{res.mejor ? formatCurrency(res.mejor.total) : "—"}</p>
            {res.mejor && <p className="text-[11px] text-brand-gray">{nombrePunto(res.mejor.date, range)}</p>}
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
                <linearGradient id="vc-grad" gradientUnits="userSpaceOnUse" x1="0" y1={m.t} x2="0" y2={yNormal}>
                  <stop offset="0%" style={{ stopColor: AZUL, stopOpacity: 0.8 }} />
                  <stop offset="100%" style={{ stopColor: AZUL, stopOpacity: 0.12 }} />
                </linearGradient>
                <linearGradient id="vc-rojo" gradientUnits="userSpaceOnUse" x1="0" y1={yNormal} x2="0" y2={m.t + h}>
                  <stop offset="0%" style={{ stopColor: "rgb(220 60 60)", stopOpacity: 0.02 }} />
                  <stop offset="100%" style={{ stopColor: "rgb(220 60 60)", stopOpacity: 0.32 }} />
                </linearGradient>
                <clipPath id="vc-base"><rect x={m.l} y={yNormal} width={w} height={Math.max(0, m.t + h - yNormal)} /></clipPath>
                <clipPath id="vc-sobre"><rect x={m.l} y={m.t} width={w} height={Math.max(0, yNormal - m.t)} /></clipPath>
                <clipPath id="vc-bajo"><rect x={m.l} y={yNormal} width={w} height={Math.max(0, m.t + h - yNormal)} /></clipPath>
              </defs>
              {/* Marcas y líneas guía */}
              {marcas.map((v) => (
                <g key={v}>
                  <line x1={m.l} x2={ancho - m.r} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-brand-gray" strokeOpacity={v === 0 ? 0.25 : 0.12} strokeDasharray={v === 0 ? undefined : "3 4"} />
                  <text x={m.l - 8} y={y(v) + 3.5} textAnchor="end" className="fill-brand-gray" style={{ fontSize: 10.5 }}>{montoCorto(v)}</text>
                </g>
              ))}
              {/* Etiquetas del eje horizontal */}
              {data.map((d, i) => etiquetaVisible(i) && (
                <text key={d.date} x={x(i)} y={m.t + h + 15} textAnchor={i === 0 && data.length > 1 ? "start" : i === data.length - 1 && data.length > 1 ? "end" : "middle"}
                  className={hover === i ? "fill-brand-blue" : "fill-brand-gray"} style={{ fontSize: 10.5, fontWeight: hover === i ? 700 : 500 }}>{d.label}</text>
              ))}
              {/* Relleno por fuerza (como la referencia): azul más intenso cuanto más alto sobre lo normal, rojo suave cuando se queda por debajo */}
              {area && (
                <g>
                  <path d={area} clipPath="url(#vc-base)" style={{ fill: AZUL }} fillOpacity={0.07} />
                  <path d={entreLinea} clipPath="url(#vc-sobre)" fill="url(#vc-grad)" />
                  <path d={entreLinea} clipPath="url(#vc-bajo)" fill="url(#vc-rojo)" />
                </g>
              )}
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
                {inten[hover!] && inten[hover!].tono !== "sin" && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-brand-dark">
                    <span className="h-2 w-2 rounded-sm" style={{ background: colorTono(inten[hover!]), outline: "1px solid rgb(148 163 184 / .4)" }} />
                    {ETIQUETA_NIVEL[inten[hover!].nivel]}
                    <span className="font-normal text-brand-gray">· normal {formatCurrency(Math.round(inten[hover!].referencia))}</span>
                  </p>
                )}
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
