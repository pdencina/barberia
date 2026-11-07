"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, Panel, Segmented } from "@/components/ui/premium";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import { nivelOcup, ordenarPros, pctOcup, totalGrupo, type MesOc, type Modo, type NivelOc, type Orden, type ResultadoOc } from "@/lib/ocupacion";

type Datos = ResultadoOc & { desde?: string; hasta?: string; mesEnCurso?: string; error?: string };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesLargo = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const mesCorto = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1].slice(0, 3)} ${m.slice(2, 4)}`;
const horasTxt = (min: number) => { const h = min / 60; return `${h >= 100 ? Math.round(h) : Math.round(h * 10) / 10}`.replace(".", ",") + " h"; };

const COLOR: Record<NivelOc, { fondo: string; texto: string; suave: string; nombre: string }> = {
  alto: { fondo: "bg-emerald-500", texto: "text-emerald-600", suave: "bg-emerald-50", nombre: "Bien" },
  medio: { fondo: "bg-amber-400", texto: "text-amber-600", suave: "bg-amber-50", nombre: "Regular" },
  bajo: { fondo: "bg-red-400", texto: "text-red-500", suave: "bg-red-50", nombre: "Bajo" },
};
const HEX: Record<NivelOc, string> = { alto: "#10b981", medio: "#fbbf24", bajo: "#f87171" };
const MODOS: { modo: Modo; titulo: string; sub: string }[] = [
  { modo: "comision", titulo: "Profesionales a comisión", sub: "Ganan un % de lo que venden: cada hora vacía también es plata que no entra al negocio." },
  { modo: "arriendo", titulo: "Profesionales con arriendo", sub: "Pagan el arriendo del sillón: su ocupación muestra cuánto sacan de ese pago." },
];

// Anillo con el porcentaje al centro.
function Anillo({ pct, size = 88 }: { pct: number; size?: number }) {
  const r = size / 2 - 8, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={HEX[nivelOcup(pct)]} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(Math.min(pct, 100) / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-brand-dark" style={{ fontSize: size * 0.26, fontWeight: 800 }}>{pct}%</text>
    </svg>
  );
}

const Flecha = ({ pts }: { pts: number | null }) => pts === null ? null : (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${pts >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>
    {pts >= 0 ? "▲" : "▼"} {Math.abs(pts)} pts
  </span>
);

// Barras de ocupación por hora del día.
function PorHora({ disp, ocup }: { disp: number[]; ocup: number[] }) {
  const horas = Array.from({ length: 13 }, (_, i) => i + 9);   // 9 a 21
  return (
    <div>
      <div className="flex h-28 items-end gap-1.5">
        {horas.map((h) => {
          const p = pctOcup(ocup[h], disp[h]);
          const hay = disp[h] > 0;
          return (
            <div key={h} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={hay ? `${String(h).padStart(2, "0")}:00 · ${p}% ocupado` : `${String(h).padStart(2, "0")}:00 · sin horario`}>
              {hay && <span className="mb-0.5 text-[10px] font-bold tabular-nums text-brand-dark">{p}</span>}
              <div className={`w-full rounded-t-md ${hay ? COLOR[nivelOcup(p)].fondo : "bg-gray-100"}`} style={{ height: hay ? `${Math.max(p, 4)}%` : "4%" }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">{horas.map((h) => <span key={h} className="min-w-0 flex-1 text-center text-[10px] text-brand-gray">{h}</span>)}</div>
    </div>
  );
}

// Crecimiento mes a mes: barras agrupadas (comisión, arriendo y equipo) con la línea de la meta del 50%.
function Crecimiento({ d, enCurso }: { d: Datos; enCurso?: string }) {
  const serie = d.meses.map((m) => ({
    mes: m,
    com: totalGrupo(d, "comision", m), arr: totalGrupo(d, "arriendo", m), todos: totalGrupo(d, "todos", m),
  }));
  const barras = [{ k: "com" as const, n: "A comisión", c: "#0e8a8a" }, { k: "arr" as const, n: "Con arriendo", c: "#7c5cd6" }, { k: "todos" as const, n: "Todo el equipo", c: "#94a3b8" }];
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-brand-gray">
        {barras.map((b) => <span key={b.k} className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: b.c }} />{b.n}</span>)}
        <span className="inline-flex items-center gap-1.5"><i className="h-0 w-4 border-t-2 border-dashed border-gray-400" />Meta 50%</span>
      </div>
      {/* Altura útil de las barras: 150 px (100%). La línea punteada marca el 50%. */}
      <div className="relative pt-5">
        <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-gray-300" style={{ bottom: 22 + 75 }} />
        <div className="flex items-end justify-around gap-4">
          {serie.map((s) => (
            <div key={s.mes} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-end justify-center gap-1.5" style={{ height: 150 }}>
                {barras.map((b) => {
                  const p = pctOcup(s[b.k].ocup, s[b.k].disp);
                  return (
                    <div key={b.k} className="flex w-full max-w-[46px] flex-col items-center justify-end" title={`${b.n} · ${mesLargo(s.mes)}: ${p}%`}>
                      <span className="mb-0.5 text-[11px] font-bold tabular-nums text-brand-dark">{p}%</span>
                      <div className="w-full rounded-t-md" style={{ height: Math.max(p, 2) * 1.5, background: b.c }} />
                    </div>
                  );
                })}
              </div>
              <span className="mt-1.5 h-[22px] text-xs font-semibold text-brand-dark">{mesCorto(s.mes)}{s.mes === enCurso ? " · en curso" : ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Pro({ p, mes, meses, posicion, maxVentasHora }: { p: ResultadoOc["pros"][number]; mes: string; meses: string[]; posicion: number; maxVentasHora: number }) {
  const m = p.porMes[mes] || ({ disp: 0, ocup: 0, dias: 0, ventas: 0 } as MesOc);
  const pct = pctOcup(m.ocup, m.disp);
  const nivel = nivelOcup(pct);
  const muerto = Math.max(0, m.disp - m.ocup);
  const idx = meses.indexOf(mes);
  const ant = idx > 0 ? p.porMes[meses[idx - 1]] : null;
  const delta = ant && ant.disp > 0 && m.disp > 0 ? pct - pctOcup(ant.ocup, ant.disp) : null;
  const ventasHora = m.ocup > 0 ? m.ventas / (m.ocup / 60) : 0;
  return (
    <li className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-4">
        <span className="hidden h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-brand-gray sm:flex">{posicion}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="truncate text-base font-bold text-brand-dark">{p.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${COLOR[nivel].suave} ${COLOR[nivel].texto}`}>{COLOR[nivel].nombre}</span>
            <Flecha pts={delta} />
          </div>
          <div className="mt-2.5 flex h-3.5 overflow-hidden rounded-full bg-red-100" title={`${horasTxt(m.ocup)} ocupadas · ${horasTxt(muerto)} sin cliente`}>
            <div className={`${COLOR[nivel].fondo} h-full`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex flex-wrap justify-between gap-x-4 text-xs text-brand-gray">
            <span><b className="text-brand-dark">{horasTxt(m.ocup)}</b> con cliente</span>
            <span><b className="text-red-500">{horasTxt(muerto)}</b> sin cliente</span>
            <span>de {horasTxt(m.disp)} disponibles</span>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end">
          <span className={`text-3xl font-extrabold leading-none tabular-nums ${COLOR[nivel].texto}`}>{pct}%</span>
          <span className="mt-1 text-[11px] text-brand-gray">ocupación</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-gray-50 pt-3">
        <div className="text-xs text-brand-gray">
          Ventas <b className="text-brand-dark">{formatCurrency(m.ventas)}</b>
          {ventasHora > 0 && <> · <b className="text-brand-dark">{formatCurrency(Math.round(ventasHora))}</b> por hora ocupada</>}
          {maxVentasHora > 0 && ventasHora >= maxVentasHora * 0.999 && ventasHora > 0 && <span className="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">mejor del grupo</span>}
        </div>
        {meses.length > 1 && (
          <div className="flex items-end gap-1.5" title="Ocupación mes a mes">
            {meses.map((mm) => {
              const x = p.porMes[mm]; const pp = x ? pctOcup(x.ocup, x.disp) : 0;
              return (
                <div key={mm} className="flex w-9 flex-col items-center">
                  <span className="text-[10px] font-bold tabular-nums text-brand-dark">{x && x.disp > 0 ? `${pp}%` : "–"}</span>
                  <div className="flex h-9 w-full items-end"><div className={`w-full rounded-t ${x && x.disp > 0 ? COLOR[nivelOcup(pp)].fondo : "bg-gray-100"} ${mm === mes ? "" : "opacity-50"}`} style={{ height: `${Math.max(pp, 6)}%` }} /></div>
                  <span className="text-[9px] text-brand-gray">{mesCorto(mm).split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </li>
  );
}

export default function OcupacionPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [mes, setMes] = useState("");
  const [orden, setOrden] = useState<Orden>("ocupacion");
  const [asc, setAsc] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/ocupacion", { cache: "no-store" })
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) setError(j?.error || "No se pudo cargar"); else { setD(j); setMes((j.meses || []).slice(-1)[0] || ""); } })
      .catch(() => setError("No se pudo cargar"));
  }, [isAdmin]);

  const idx = d ? d.meses.indexOf(mes) : -1;
  const equipo = d && mes ? totalGrupo(d, "todos", mes) : null;
  const equipoAnt = d && idx > 0 ? totalGrupo(d, "todos", d.meses[idx - 1]) : null;
  const pctEquipo = equipo ? pctOcup(equipo.ocup, equipo.disp) : 0;
  const deltaEquipo = equipo && equipoAnt && equipoAnt.disp > 0 ? pctEquipo - pctOcup(equipoAnt.ocup, equipoAnt.disp) : null;
  const ventasHoraEquipo = equipo && equipo.ocup > 0 ? equipo.ventas / (equipo.ocup / 60) : 0;
  const enCurso = !!d && mes === d.mesEnCurso;
  const diaHasta = d?.hasta ? Number(d.hasta.slice(8, 10)) : 0;

  const grupos = useMemo(() => {
    if (!d || !mes) return [];
    return MODOS.map((g) => {
      const pros = ordenarPros(d.pros.filter((p) => p.modo === g.modo), mes, orden, asc);
      const t = totalGrupo(d, g.modo, mes);
      const ant = idx > 0 ? totalGrupo(d, g.modo, d.meses[idx - 1]) : null;
      const maxVH = Math.max(0, ...pros.map((p) => { const m = p.porMes[mes]; return m && m.ocup > 0 ? m.ventas / (m.ocup / 60) : 0; }));
      return { ...g, pros, t, delta: ant && ant.disp > 0 ? pctOcup(t.ocup, t.disp) - pctOcup(ant.ocup, ant.disp) : null, maxVH };
    });
  }, [d, mes, orden, asc, idx]);

  if (!isAdmin) return <div className="p-8 text-sm text-brand-gray">Solo el administrador puede ver esta pantalla.</div>;
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-3 md:p-8">
      <PageHeader title="Ocupación de profesionales" subtitle="De las horas que cada uno está disponible, cuántas tienen un cliente. Lo que sobra es tiempo muerto." inline />

      {!d && !error && <div className="flex justify-center py-16"><Spinner /></div>}
      {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {d && d.meses.length === 0 && !error && <Panel><p className="p-5 text-sm text-brand-gray">Todavía no hay meses con suficientes citas completadas para medir la ocupación.</p></Panel>}

      {d && d.meses.length > 0 && equipo && (
        <>
          {/* Controles */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented size="sm" value={mes} onChange={setMes} options={d.meses.map((m) => ({ value: m, label: mesCorto(m) + (m === d.mesEnCurso ? " · en curso" : "") }))} />
            <div className="flex items-center gap-2 text-xs text-brand-gray">
              <span>Ordenar por</span>
              <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-brand-dark">
                <option value="ocupacion">Ocupación</option>
                <option value="muerto">Tiempo muerto</option>
                <option value="ventas">Ventas</option>
                <option value="nombre">Nombre</option>
              </select>
              <button type="button" onClick={() => setAsc((v) => !v)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-brand-dark" title="Cambiar el sentido del orden">
                {orden === "nombre" ? (asc ? "A → Z" : "Z → A") : asc ? "Menor a mayor ↑" : "Mayor a menor ↓"}
              </button>
            </div>
          </div>
          {enCurso && <p className="-mt-2 text-xs text-brand-gray">Mes en curso: se mide hasta ayer (día {diaHasta}). Hoy aún no termina.</p>}

          {/* Resumen del equipo */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4">
              <Anillo pct={pctEquipo} />
              <div>
                <p className="text-xs font-semibold text-brand-gray">Ocupación del equipo</p>
                <p className="mt-1 text-xs text-brand-dark">{horasTxt(equipo.ocup)} con cliente de {horasTxt(equipo.disp)}</p>
                <div className="mt-1.5"><Flecha pts={deltaEquipo} /></div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-xs font-semibold text-brand-gray">Tiempo muerto del equipo</p>
              <p className="mt-1.5 text-3xl font-extrabold leading-none tabular-nums text-red-500">{horasTxt(Math.max(0, equipo.disp - equipo.ocup))}</p>
              <p className="mt-2 text-xs text-brand-gray">horas disponibles sin ningún cliente</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-xs font-semibold text-brand-gray">Cada hora ocupada vale</p>
              <p className="mt-1.5 text-3xl font-extrabold leading-none tabular-nums text-brand-dark">{formatCurrency(Math.round(ventasHoraEquipo))}</p>
              <p className="mt-2 text-xs text-brand-gray">en ventas. Llenar una hora vacía suma eso.</p>
            </div>
          </div>

          {/* Crecimiento */}
          <Panel title="Crecimiento mes a mes" subtitle="Ocupación por modalidad. La meta es llegar al 50% o más.">
            <div className="px-4 pb-4 md:px-5"><Crecimiento d={d} enCurso={d.mesEnCurso} /></div>
          </Panel>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-brand-gray">
            <span className="font-semibold text-brand-dark">Cómo leer los colores:</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />50% o más: bien</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-400" />35% a 49%: regular</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-red-400" />menos de 35%: bajo</span>
          </div>

          {/* Por modalidad */}
          {grupos.map((g) => g.pros.length > 0 && (
            <section key={g.modo} className="space-y-3">
              <div className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-brand-dark">{g.titulo} <span className="text-sm font-medium text-brand-gray">({g.pros.length})</span></h2>
                    <p className="mt-0.5 max-w-xl text-xs text-brand-gray">{g.sub}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[11px] text-brand-gray">Ocupación del grupo</p>
                      <p className={`text-2xl font-extrabold tabular-nums ${COLOR[nivelOcup(pctOcup(g.t.ocup, g.t.disp))].texto}`}>{pctOcup(g.t.ocup, g.t.disp)}%</p>
                    </div>
                    <Flecha pts={g.delta} />
                    <div className="hidden text-right sm:block">
                      <p className="text-[11px] text-brand-gray">Tiempo muerto</p>
                      <p className="text-2xl font-extrabold tabular-nums text-red-500">{horasTxt(Math.max(0, g.t.disp - g.t.ocup))}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-brand-dark">¿A qué hora se llena? <span className="font-normal text-brand-gray">Ocupación por hora del día en {mesLargo(mes)}</span></p>
                  <PorHora disp={d.horas[mes]?.[g.modo]?.disp || []} ocup={d.horas[mes]?.[g.modo]?.ocup || []} />
                </div>
              </div>
              <ul className="space-y-2.5">
                {g.pros.map((p, i) => <Pro key={p.id} p={p} mes={mes} meses={d.meses} posicion={i + 1} maxVentasHora={g.maxVH} />)}
              </ul>
            </section>
          ))}

          <p className="text-[11px] leading-relaxed text-brand-gray">
            Cómo se calcula: horas disponibles = el horario de cada profesional menos colación, bloqueos y vacaciones. Horas ocupadas = el tiempo de sus citas completadas.
            Tiempo muerto = la diferencia. Es la duración de las citas en la agenda, no el tiempo real en la silla. Un día sin ninguna cita igual cuenta como disponible.
            Solo se mide desde el primer mes en que el equipo cerró las ventas en re-booking.
          </p>
        </>
      )}
    </div>
  );
}
