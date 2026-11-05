"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Lock } from "lucide-react";
import { formatCurrency, todayInChile } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { ahorroRecomendado, gastosPorCategoria, lecturaDelMes, repartoMes } from "@/lib/billetera";

interface Mov { kind: "expense" | "income"; amount: number; category: string }
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const finMes = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
const AZUL = "hsl(var(--brand-blue))";
const COLOR = { gastos: AZUL, ahorro: "#10b981", saldo: "#cbd5e1" };

async function movimientos(y: number, m: number): Promise<Mov[] | null> {
  try {
    const r = await fetch(`/api/personal/movimientos?desde=${y}-${String(m).padStart(2, "0")}-01&hasta=${finMes(y, m)}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    return r.ok && !d?.migracionPendiente ? (d.items || []) : null;
  } catch { return null; }
}

// Torta del mes: tu sueldo repartido en gastos personales (los que anotas a mano o con Oti), ahorro intocable y saldo restante.
// Incluye el reporte con porcentajes (también en PDF).
export function PresupuestoPersonal() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const hoy = todayInChile();
  const [y, setY] = useState(Number(hoy.slice(0, 4)));
  const [m, setM] = useState(Number(hoy.slice(5, 7)));
  const mes = `${y}-${String(m).padStart(2, "0")}`;
  const esMesActual = mes === hoy.slice(0, 7);

  const [cargando, setCargando] = useState(true);
  const [pendiente, setPendiente] = useState(false);
  const [sueldoTxt, setSueldoTxt] = useState("");
  const [pct, setPct] = useState<number | null>(null);        // % elegido (null = aún sin elegir: se usa el recomendado)
  const [existe, setExiste] = useState(false);
  const [sugerido, setSugerido] = useState<{ salary: number; savings_pct: number } | null>(null);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [gastosPrevio, setGastosPrevio] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
      const [pres, actual, previo] = await Promise.all([
        fetch(`/api/personal/presupuesto?mes=${mes}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        movimientos(y, m), movimientos(py, pm),
      ]);
      setPendiente(!!pres?.migracionPendiente || actual === null);
      setExiste(!!pres?.existe);
      setSueldoTxt(pres?.salary ? String(pres.salary) : "");
      setPct(pres?.savings_pct ?? null);
      setSugerido(pres?.sugerido || null);
      setMovs(actual || []);
      setGastosPrevio(previo ? previo.filter((i) => i.kind === "expense").reduce((s, i) => s + i.amount, 0) : null);
    } finally { setCargando(false); }
  }, [y, m, mes]);
  useEffect(() => { cargar(); }, [cargar]);
  // Oti avisa cuando anota un gasto: la torta se actualiza sola.
  useEffect(() => { const f = () => cargar(); window.addEventListener("personal-entries-changed", f); return () => window.removeEventListener("personal-entries-changed", f); }, [cargar]);

  const sueldo = Number(sueldoTxt.replace(/\D/g, "")) || 0;
  const gastos = movs.filter((i) => i.kind === "expense");
  const gastosTotal = gastos.reduce((s, i) => s + i.amount, 0);
  const otros = movs.filter((i) => i.kind === "income").reduce((s, i) => s + i.amount, 0);
  // Realidad para recomendar: los gastos del mes anterior; si no hay, lo que va de este mes.
  const refGastos = gastosPrevio && gastosPrevio > 0 ? gastosPrevio : gastosTotal > 0 ? gastosTotal : null;
  const rec = useMemo(() => ahorroRecomendado(sueldo + otros, refGastos), [sueldo, otros, refGastos]);
  const pctUsado = pct ?? rec.pct;
  const r = repartoMes({ sueldo, otrosIngresos: otros, gastos: gastosTotal, ahorroPct: pctUsado });
  const cats = gastosPorCategoria(gastos, r.base);
  const lectura = lecturaDelMes(r, pctUsado, gastosPrevio);

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch("/api/personal/presupuesto", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mes, salary: sueldo, savings_pct: pctUsado }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d?.error || "No pude guardar", "error"); return; }
      setExiste(true); setPct(pctUsado);
      showToast("Sueldo y ahorro guardados", "success");
    } finally { setGuardando(false); }
  };

  const descargar = async () => {
    try {
      const { generarPdfBilletera } = await import("@/lib/billetera-pdf");
      const blob = await generarPdfBilletera({ nombre: user?.name || "Mi Billetera", mesTexto: `${MESES[m - 1]} ${y}`, reparto: r, sueldo, otrosIngresos: otros, ahorroPct: pctUsado, categorias: cats, lectura });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `reporte-billetera-${mes}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { showToast("No pude generar el PDF", "error"); }
  };

  const cambiarMes = (d: number) => { const t = y * 12 + (m - 1) + d; setY(Math.floor(t / 12)); setM((t % 12) + 1); };

  // Torta
  const R = 56, C = 2 * Math.PI * R;
  const partes = [
    { k: "gastos", nombre: "Gastos personales", monto: r.gastos, pct: r.pct.gastos, color: COLOR.gastos },
    { k: "ahorro", nombre: "Ahorro (intocable)", monto: r.ahorro, pct: r.pct.ahorro, color: COLOR.ahorro },
    { k: "saldo", nombre: "Saldo restante", monto: r.saldo, pct: r.pct.saldo, color: COLOR.saldo },
  ];
  const sumaTorta = Math.max(r.gastos + r.ahorro + r.saldo, 1);
  let acum = 0;

  if (pendiente) return null; // sin la migración 124/137 la sección no se muestra (los gastos personales ya avisan por su cuenta)

  return (
    <div className="space-y-3 md:space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-brand-dark">Mi sueldo y mi ahorro</h3>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => cambiarMes(-1)} aria-label="Mes anterior" className="rounded-lg p-1 text-brand-gray hover:bg-brand-light"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[110px] text-center text-xs font-semibold text-brand-dark">{MESES[m - 1]} {y}</span>
            <button type="button" onClick={() => cambiarMes(1)} disabled={esMesActual} aria-label="Mes siguiente" className="rounded-lg p-1 text-brand-gray hover:bg-brand-light disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        {cargando ? <div className="flex h-40 items-center justify-center text-sm text-brand-gray">Cargando…</div> : (
          <>
            {/* Sueldo */}
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-brand-gray">Sueldo del mes (lo anotas tú)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-gray">$</span>
                  <input inputMode="numeric" value={sueldo ? sueldo.toLocaleString("es-CL") : ""} onChange={(e) => setSueldoTxt(e.target.value.replace(/\D/g, ""))} placeholder="Ej: 850.000"
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-7 pr-3 text-sm text-brand-dark outline-none focus:border-brand-blue" />
                </div>
                <button type="button" onClick={guardar} disabled={guardando} className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{guardando ? "…" : "Guardar"}</button>
              </div>
              {!existe && sugerido && sugerido.salary > 0 && (
                <button type="button" onClick={() => { setSueldoTxt(String(sugerido.salary)); setPct(sugerido.savings_pct); }} className="mt-1.5 text-xs font-medium text-brand-blue hover:underline">
                  Usar lo del mes pasado ({formatCurrency(sugerido.salary)})
                </button>
              )}
              {otros > 0 && <p className="mt-1.5 text-[11px] text-brand-gray">Sumamos {formatCurrency(otros)} de otros ingresos que anotaste este mes.</p>}
            </div>

            {/* Ahorro */}
            <div className="mt-4 rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-bold text-brand-dark"><Lock className="h-3.5 w-3.5 text-emerald-600" /> Ahorro <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">intocable</span></p>
                <p className="text-sm font-extrabold tabular-nums text-emerald-700">{Math.round(pctUsado)} % · {formatCurrency(r.ahorro)}</p>
              </div>
              <input type="range" min={0} max={40} step={1} value={Math.round(pctUsado)} onChange={(e) => setPct(Number(e.target.value))} aria-label="Porcentaje de ahorro" className="mt-2 w-full accent-emerald-600" />
              <p className="mt-1 text-xs leading-relaxed text-brand-dark">
                <b>Recomendado para ti: {rec.pct} %.</b> <span className="text-brand-gray">{rec.razon}</span>
              </p>
              {Math.round(pctUsado) !== rec.pct && <button type="button" onClick={() => setPct(rec.pct)} className="mt-1 text-xs font-semibold text-emerald-700 hover:underline">Usar el recomendado ({rec.pct} %)</button>}
              <p className="mt-2 text-[11px] text-brand-gray">Este dinero se aparta primero: no cuenta como saldo disponible, así no se gasta sin querer.</p>
            </div>

            {/* Torta */}
            {r.base > 0 ? (
              <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative h-40 w-40 flex-shrink-0">
                  <svg viewBox="0 0 150 150" className="h-full w-full -rotate-90" role="img" aria-label="Reparto del sueldo del mes">
                    <circle cx="75" cy="75" r={R} fill="none" stroke="currentColor" className="text-brand-gray" strokeOpacity={0.08} strokeWidth="20" />
                    {partes.map((p) => {
                      const largo = (p.monto / sumaTorta) * C;
                      const el = p.monto > 0 ? <circle key={p.k} cx="75" cy="75" r={R} fill="none" strokeWidth="20" style={{ stroke: p.color }} strokeDasharray={`${Math.max(largo - 1.5, 0.5)} ${C}`} strokeDashoffset={-acum} /> : null;
                      acum += largo; return el;
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray">Ingresos</span>
                    <span className="text-base font-extrabold tabular-nums text-brand-dark">{formatCurrency(r.base)}</span>
                  </div>
                </div>
                <ul className="w-full min-w-0 flex-1 space-y-2.5">
                  {partes.map((p) => (
                    <li key={p.k} className="flex items-center gap-2.5 text-sm">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: p.color }} />
                      <div className="min-w-0 flex-1"><p className="truncate text-brand-dark">{p.nombre}</p><p className="text-[11px] tabular-nums text-brand-gray">{formatCurrency(p.monto)}</p></div>
                      <span className="flex-shrink-0 text-sm font-bold tabular-nums text-brand-dark">{p.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <p className="mt-4 rounded-xl bg-brand-light/70 p-3 text-center text-xs text-brand-gray">Anota tu sueldo y verás aquí cómo se reparte: gastos, ahorro y saldo.</p>}

            {r.base > 0 && r.sobregiro > 0 && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-600">Lo gastado más el ahorro se pasa de tus ingresos por <b>{formatCurrency(r.sobregiro)}</b>. Mejor recorta gastos que tocar el ahorro.</p>
            )}
          </>
        )}
      </div>

      {/* Reporte con porcentajes */}
      {!cargando && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-brand-dark">Reporte del mes</h3>
            <button type="button" onClick={descargar} disabled={r.base <= 0} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-brand-dark hover:border-brand-blue hover:text-brand-blue disabled:opacity-40">
              <Download className="h-3.5 w-3.5" /> Descargar PDF
            </button>
          </div>
          <div className="mt-3 space-y-1.5 text-sm">
            {[["Ingresos", r.base, 100], ["Gastos personales", r.gastos, r.pct.gastos], [`Ahorro (${Math.round(pctUsado)} %)`, r.ahorro, r.pct.ahorro], ["Saldo restante", r.saldo, r.pct.saldo]].map(([n, v, p]) => (
              <div key={n as string} className="flex items-center justify-between gap-3"><span className="text-brand-gray">{n}</span><span className="tabular-nums text-brand-dark"><b>{formatCurrency(v as number)}</b> <span className="text-brand-gray">· {p}%</span></span></div>
            ))}
          </div>
          {cats.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-brand-gray">En qué gastaste</p>
              <div className="space-y-2.5">
                {cats.map((c) => (
                  <div key={c.category}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className="truncate text-brand-dark">{c.category}</span><span className="flex-shrink-0 tabular-nums text-brand-dark"><b>{formatCurrency(c.amount)}</b> <span className="text-xs text-brand-gray">· {c.pctGastos}%</span></span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-brand-blue/70" style={{ width: `${Math.max(c.pctGastos, 3)}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ul className="mt-4 space-y-1.5 rounded-xl bg-brand-light/70 p-3 text-xs leading-relaxed text-brand-dark">
            {lectura.map((l) => <li key={l}>• {l}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
