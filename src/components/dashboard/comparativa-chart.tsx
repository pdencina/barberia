"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { marcasEje, montoCorto } from "@/lib/dashboard-format";

export interface PuntoComparativa { label: string; income: number; expenses: number }

const AZUL = "hsl(var(--brand-blue))";
const ROJO = "rgb(220 80 80)";

// Comparativa mensual de ingresos y egresos con el mismo estilo del gráfico de ventas del Dashboard: curva suave, relleno que se
// intensifica con el monto, ejes con montos cortos, cuadro al pasar el mouse o tocar, y se puede ver solo una de las dos series.
export function ComparativaChart({ data }: { data: PuntoComparativa[] }) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [verIngresos, setVerIngresos] = useState(true);
  const [verEgresos, setVerEgresos] = useState(true);
  const [oculto, setOculto] = useState(false);
  const $ = (t: string) => (oculto ? "$ ••••••" : t);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setAncho(Math.max(260, Math.floor(el.clientWidth)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const alto = ancho < 420 ? 210 : 260;
  const m = { l: 58, r: 14, t: 12, b: 26 };
  const w = ancho - m.l - m.r, h = alto - m.t - m.b;
  const max = Math.max(...data.map((d) => Math.max(verIngresos ? d.income : 0, verEgresos ? d.expenses : 0)), 1);
  const marcas = marcasEje(max, ancho < 420 ? 3 : 4);
  const tope = marcas[marcas.length - 1] || 1;
  const x = (i: number) => m.l + (data.length <= 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v: number) => m.t + h - (v / tope) * h;

  // Curva suave que no se pasa de los datos (interpolación monótona).
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
      const a = t[i] / sl[i], b = t[i + 1] / sl[i], hh = Math.hypot(a, b);
      if (hh > 3) { t[i] = (3 * a * sl[i]) / hh; t[i + 1] = (3 * b * sl[i]) / hh; }
    }
    let d = `M${px[0]},${py[0]}`;
    for (let i = 0; i < n - 1; i++) d += ` C${px[i] + dx[i] / 3},${py[i] + (t[i] * dx[i]) / 3} ${px[i + 1] - dx[i] / 3},${py[i + 1] - (t[i + 1] * dx[i]) / 3} ${px[i + 1]},${py[i + 1]}`;
    return d;
  };
  const lineaIng = trazo(data.map((d) => d.income));
  const lineaEgr = trazo(data.map((d) => d.expenses));
  const base = m.t + h;
  const areaIng = data.length > 1 ? `${lineaIng} L${x(data.length - 1)},${base} L${x(0)},${base} Z` : "";
  const areaEgr = data.length > 1 ? `${lineaEgr} L${x(data.length - 1)},${base} L${x(0)},${base} Z` : "";

  const mover = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - m.l) / (w || 1)) * (data.length - 1));
    setHover(Math.min(Math.max(i, 0), data.length - 1));
  };
  const sel = hover !== null ? data[hover] : null;
  const boton = "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-all";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={verIngresos} onClick={() => { if (verIngresos && !verEgresos) return; setVerIngresos((v) => !v); }}
            className={cn(boton, verIngresos ? "border-brand-blue/40 bg-brand-blue/5 text-brand-dark" : "border-gray-200 text-brand-gray line-through opacity-60")}>
            <span className="h-0.5 w-4 rounded" style={{ background: AZUL }} /> Ingresos
          </button>
          <button type="button" aria-pressed={verEgresos} onClick={() => { if (verEgresos && !verIngresos) return; setVerEgresos((v) => !v); }}
            className={cn(boton, verEgresos ? "border-red-200 bg-red-50/60 text-brand-dark" : "border-gray-200 text-brand-gray line-through opacity-60")}>
            <span className="h-0.5 w-4 rounded" style={{ background: ROJO }} /> Egresos
          </button>
        </div>
        <button type="button" onClick={() => setOculto((v) => !v)} title={oculto ? "Mostrar montos" : "Ocultar montos"} aria-label={oculto ? "Mostrar montos" : "Ocultar montos"}
          className="rounded-full p-1 text-brand-gray transition-colors hover:bg-brand-light hover:text-brand-dark">
          {oculto ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <div ref={caja} className="relative mt-2">
        <svg width={ancho} height={alto} role="img" aria-label="Comparativa mensual de ingresos y egresos" className="block select-none"
          style={{ touchAction: "pan-y" }} onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="cmp-ing" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: AZUL, stopOpacity: 0.55 }} /><stop offset="100%" style={{ stopColor: AZUL, stopOpacity: 0.03 }} /></linearGradient>
            <linearGradient id="cmp-egr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: ROJO, stopOpacity: 0.28 }} /><stop offset="100%" style={{ stopColor: ROJO, stopOpacity: 0.02 }} /></linearGradient>
          </defs>
          {marcas.map((v) => (
            <g key={v}>
              <line x1={m.l} x2={ancho - m.r} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-brand-gray" strokeOpacity={v === 0 ? 0.25 : 0.12} strokeDasharray={v === 0 ? undefined : "3 4"} />
              <text x={m.l - 8} y={y(v) + 3.5} textAnchor="end" className="fill-brand-gray" style={{ fontSize: 10.5 }}>{oculto ? (v === 0 ? "$0" : "••") : montoCorto(v)}</text>
            </g>
          ))}
          {data.map((d, i) => (
            <text key={d.label} x={x(i)} y={alto - 8} textAnchor={i === 0 && data.length > 1 ? "start" : i === data.length - 1 && data.length > 1 ? "end" : "middle"}
              className={hover === i ? "fill-brand-blue" : "fill-brand-gray"} style={{ fontSize: 10.5, fontWeight: hover === i ? 700 : 500 }}>{d.label}</text>
          ))}
          {verEgresos && areaEgr && <path d={areaEgr} fill="url(#cmp-egr)" />}
          {verIngresos && areaIng && <path d={areaIng} fill="url(#cmp-ing)" />}
          {verEgresos && <path d={lineaEgr} fill="none" style={{ stroke: ROJO }} strokeOpacity={0.85} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
          {verIngresos && <path d={lineaIng} fill="none" style={{ stroke: AZUL }} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
          {data.map((d, i) => (
            <g key={`p-${d.label}`}>
              {verIngresos && <circle cx={x(i)} cy={y(d.income)} r={hover === i ? 5 : 3} style={{ stroke: AZUL }} className="fill-white" strokeWidth={2} />}
              {verEgresos && <circle cx={x(i)} cy={y(d.expenses)} r={hover === i ? 4.5 : 2.5} style={{ stroke: ROJO }} className="fill-white" strokeWidth={1.8} />}
            </g>
          ))}
          {sel && <line x1={x(hover!)} x2={x(hover!)} y1={m.t} y2={base} style={{ stroke: AZUL }} strokeOpacity={0.3} strokeWidth={1} />}
        </svg>
        {sel && (
          <div className="pointer-events-none absolute top-0 z-10 w-max -translate-x-1/2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10"
            style={{ left: Math.min(Math.max(x(hover!), 78), ancho - 78) }}>
            <p className="font-semibold text-brand-dark">{sel.label}</p>
            {verIngresos && <p className="mt-0.5 tabular-nums"><span className="text-brand-gray">Ingresos </span><b className="text-brand-blue">{$(formatCurrency(sel.income))}</b></p>}
            {verEgresos && <p className="tabular-nums"><span className="text-brand-gray">Egresos </span><b className="text-red-500">{$(formatCurrency(sel.expenses))}</b></p>}
            {verIngresos && verEgresos && <p className="mt-0.5 border-t border-gray-100 pt-0.5 tabular-nums"><span className="text-brand-gray">Resultado </span><b className={sel.income - sel.expenses >= 0 ? "text-emerald-600" : "text-red-500"}>{$(formatCurrency(sel.income - sel.expenses))}</b></p>}
          </div>
        )}
      </div>
    </div>
  );
}
