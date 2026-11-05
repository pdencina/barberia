"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { marcasEje, montoCorto } from "@/lib/dashboard-format";
import { variacion, type FilaMes } from "@/lib/billetera";

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const etq = (ym: string) => `${MES[Number(ym.slice(5, 7)) - 1]}`;
const etqLargo = (ym: string) => `${MES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const AZUL = "hsl(var(--brand-blue))";

function Grafico({ datos, valor, formato, tipo, id }: { datos: FilaMes[]; valor: (f: FilaMes) => number; formato: (n: number) => string; tipo: "area" | "barras"; id: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(320);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = caja.current; if (!el) return;
    const med = () => setAncho(Math.max(240, Math.floor(el.clientWidth)));
    med(); const ro = new ResizeObserver(med); ro.observe(el); return () => ro.disconnect();
  }, []);
  const alto = 190, mg = { l: 52, r: 8, t: 10, b: 24 };
  const w = ancho - mg.l - mg.r, h = alto - mg.t - mg.b;
  const max = Math.max(...datos.map(valor), 1);
  const marcas = marcasEje(max, 3), tope = marcas[marcas.length - 1] || 1;
  const x = (i: number) => mg.l + (datos.length <= 1 ? w / 2 : (i / (datos.length - 1)) * w);
  const y = (v: number) => mg.t + h - (v / tope) * h;
  const pts = datos.map((d, i) => `${x(i)},${y(valor(d))}`);
  const linea = `M${pts.join(" L")}`;
  const area = `${linea} L${x(datos.length - 1)},${mg.t + h} L${x(0)},${mg.t + h} Z`;
  const bw = Math.min(26, w / datos.length - 5);
  const mover = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = tipo === "area" ? Math.round(((e.clientX - r.left - mg.l) / (w || 1)) * (datos.length - 1)) : Math.floor(((e.clientX - r.left - mg.l) / (w || 1)) * datos.length);
    setHover(Math.min(Math.max(i, 0), datos.length - 1));
  };
  const sel = hover !== null ? datos[hover] : null;
  return (
    <div ref={caja} className="relative">
      <svg width={ancho} height={alto} className="block select-none" style={{ touchAction: "pan-y" }} onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: AZUL, stopOpacity: 0.55 }} /><stop offset="100%" style={{ stopColor: AZUL, stopOpacity: 0.04 }} /></linearGradient>
        </defs>
        {marcas.map((v) => (
          <g key={v}>
            <line x1={mg.l} x2={ancho - mg.r} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-brand-gray" strokeOpacity={v === 0 ? 0.25 : 0.12} strokeDasharray={v === 0 ? undefined : "3 4"} />
            <text x={mg.l - 6} y={y(v) + 3.5} textAnchor="end" className="fill-brand-gray" style={{ fontSize: 10 }}>{tipo === "area" ? montoCorto(v) : String(v)}</text>
          </g>
        ))}
        {datos.map((d, i) => ((datos.length - 1 - i) % 2 === 0 || datos.length <= 6) && <text key={d.mes} x={x(i)} y={alto - 7} textAnchor="middle" className={hover === i ? "fill-brand-blue" : "fill-brand-gray"} style={{ fontSize: 10, fontWeight: hover === i ? 700 : 500 }}>{etq(d.mes)}</text>)}
        {tipo === "area" ? (
          <>
            <path d={area} fill={`url(#g-${id})`} />
            <path d={linea} fill="none" style={{ stroke: AZUL }} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {datos.map((d, i) => <circle key={d.mes} cx={x(i)} cy={y(valor(d))} r={hover === i ? 5 : 3} style={{ stroke: AZUL }} className="fill-white" strokeWidth={2} />)}
          </>
        ) : datos.map((d, i) => {
          const cx = mg.l + ((i + 0.5) / datos.length) * w, top = y(valor(d));
          return <rect key={d.mes} x={cx - bw / 2} y={top} width={bw} height={Math.max(mg.t + h - top, valor(d) > 0 ? 2 : 0)} rx={4} style={{ fill: AZUL }} fillOpacity={hover === i ? 0.95 : i === datos.length - 1 ? 0.8 : 0.4} />;
        })}
      </svg>
      {sel && (
        <div className="pointer-events-none absolute top-0 z-10 w-max -translate-x-1/2 rounded-xl border border-gray-100 bg-white px-3 py-1.5 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(tipo === "area" ? x(hover!) : mg.l + ((hover! + 0.5) / datos.length) * w, 60), ancho - 60) }}>
          <p className="font-semibold capitalize text-brand-dark">{etqLargo(sel.mes)}</p>
          <p className="font-extrabold tabular-nums text-brand-blue">{formato(valor(sel))}</p>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ titulo, subtitulo, children, pie }: { titulo: string; subtitulo: string; children: React.ReactNode; pie?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
      <div className="mb-3 flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-brand-blue" /><h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-brand-dark">{titulo}</h3></div>
      <p className="-mt-2 mb-3 pl-4 text-xs text-brand-gray">{subtitulo}</p>
      {children}
      {pie}
    </div>
  );
}

const Delta = ({ v, texto }: { v: number | null; texto: string }) =>
  v === null ? null : (
    <p className="mt-2 text-xs text-brand-gray">
      <span className={`mr-1.5 rounded-full px-2 py-0.5 font-semibold tabular-nums ${v >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>{v >= 0 ? "▲" : "▼"} {Math.abs(v)}%</span>{texto}
    </p>
  );

// Dos gráficos SEPARADOS: crecimiento económico (lo que ganas por mes) y crecimiento de clientes (clientes atendidos por mes).
export function CrecimientoBilletera() {
  const [meses, setMeses] = useState<FilaMes[] | null>(null);
  useEffect(() => {
    fetch("/api/wallet/historial", { cache: "no-store" }).then((r) => r.json()).then((d) => setMeses(Array.isArray(d?.meses) && !d.sinDatos ? d.meses : [])).catch(() => setMeses([]));
  }, []);
  if (!meses || meses.length === 0) return null;
  const n = meses.length, ult = meses[n - 1], pen = meses[n - 2];
  const totalNuevos = meses.reduce((s, f) => s + f.nuevos, 0);
  return (
    <div className="space-y-3 md:space-y-5">
      <Tarjeta titulo="Crecimiento económico" subtitulo="Lo que has ganado cada mes (últimos 12 meses)"
        pie={<Delta v={variacion(ult.ganado, pen?.ganado || 0)} texto={`${etqLargo(ult.mes)}: ${formatCurrency(ult.ganado)} vs mes anterior`} />}>
        <Grafico id="eco" datos={meses} valor={(f) => f.ganado} formato={formatCurrency} tipo="area" />
      </Tarjeta>
      <Tarjeta titulo="Crecimiento de clientes" subtitulo="Clientes distintos que atendiste cada mes"
        pie={<><Delta v={variacion(ult.atendidos, pen?.atendidos || 0)} texto={`${ult.atendidos} clientes en ${etqLargo(ult.mes)} vs mes anterior`} /><p className="mt-1 text-xs text-brand-gray">Clientes nuevos contigo en los últimos 12 meses: <b className="text-brand-dark">{totalNuevos}</b> ({ult.nuevos} este mes).</p></>}>
        <Grafico id="cli" datos={meses} valor={(f) => f.atendidos} formato={(v) => `${v} ${v === 1 ? "cliente" : "clientes"}`} tipo="barras" />
      </Tarjeta>
    </div>
  );
}
