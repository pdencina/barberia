"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle, CalendarCheck, Percent, UserRound } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/premium";

interface Periodo { mes: string; respuestas_automaticas: number; consultas_disponibilidad: number; ofertas_horas: number; reservas_iniciadas: number; reservas_cerradas: number; derivadas_persona: number; citas_whatsapp: number; citas_completadas: number; citas_canceladas: number; conversion_pct: number | null }
type Num = Exclude<keyof Periodo, "mes" | "conversion_pct">;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (m: string) => { const [y, mm] = m.split("-").map(Number); return `${MESES[mm - 1]} ${y}`; };
const mesActual = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 7);
const mover = (m: string, n: number) => { const [y, mm] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mm - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

const EMBUDO: { k: Num; t: string; ayuda: string }[] = [
  { k: "consultas_disponibilidad", t: "Consultas de horas", ayuda: "Clientes que preguntaron por disponibilidad" },
  { k: "ofertas_horas", t: "Horas ofrecidas", ayuda: "El agente mostró horas libres" },
  { k: "reservas_iniciadas", t: "Reservas iniciadas", ayuda: "Eligieron una hora y se les pidieron los datos" },
  { k: "reservas_cerradas", t: "Reservas cerradas", ayuda: "Quedaron agendadas por WhatsApp" },
];
const COMPARAR: { k: Num; t: string }[] = [
  { k: "respuestas_automaticas", t: "Preguntas respondidas solas" },
  { k: "consultas_disponibilidad", t: "Consultas de disponibilidad" },
  { k: "reservas_cerradas", t: "Reservas cerradas" },
  { k: "derivadas_persona", t: "Derivadas a una persona" },
  { k: "citas_completadas", t: "Citas realizadas" },
  { k: "citas_canceladas", t: "Citas canceladas" },
];

function Variacion({ ahora, antes }: { ahora: number; antes: number }) {
  if (antes === 0 && ahora === 0) return <span className="text-xs text-brand-gray">sin datos</span>;
  if (antes === 0) return <span className="text-xs font-semibold text-brand-blue">nuevo este mes</span>;
  const pct = Math.round(((ahora - antes) / antes) * 100);
  const sube = pct >= 0;
  return <span className={`text-xs font-semibold ${sube ? "text-brand-blue" : "text-red-500"}`}>{sube ? "▲" : "▼"} {Math.abs(pct)}% vs mes anterior</span>;
}

function Tarjeta({ icono, titulo, valor, pie, destacada = false }: { icono: React.ReactNode; titulo: string; valor: string | number; pie: React.ReactNode; destacada?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${destacada ? "border-transparent bg-gradient-to-br from-brand-blue to-brand-accent text-white" : "border-gray-100 bg-white dark:border-white/10 dark:bg-brand-white"}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${destacada ? "bg-white/20 text-white" : "bg-brand-blue/10 text-brand-blue"}`}>{icono}</span>
        <p className={`text-xs font-medium ${destacada ? "text-white/90" : "text-brand-gray"}`}>{titulo}</p>
      </div>
      <p className={`mt-3 text-3xl font-bold tracking-tight ${destacada ? "text-white" : "text-brand-dark"}`}>{valor}</p>
      <div className={`mt-1 ${destacada ? "text-white/90 [&_*]:!text-white/90" : ""}`}>{pie}</div>
    </div>
  );
}

interface Creditos { activo: boolean; incluidosMes: number; usadosMes: number; restantesMes: number; restantesPacks: number; disponibles: number }

export default function WhatsappIndicadoresPage() {
  const [creditos, setCreditos] = useState<Creditos | null>(null);
  useEffect(() => { fetch("/api/agente/creditos", { cache: "no-store" }).then((r) => r.json()).then((j) => setCreditos(j.creditos ?? null)).catch(() => {}); }, []);
  const [mes, setMes] = useState(mesActual());
  const [datos, setDatos] = useState<{ actual: Periodo; anterior: Periodo } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setDatos(null); setError("");
    fetch(`/api/agente/indicadores?mes=${mes}`, { cache: "no-store" }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j.error || "No se pudo cargar"); else setDatos(j);
    }).catch(() => setError("No se pudo cargar"));
  }, [mes]);

  const a = datos?.actual, p = datos?.anterior;
  const maxEmbudo = a ? Math.max(1, ...EMBUDO.map((f) => a[f.k])) : 1;

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-5xl animate-fade-in">
      <PageHeader title="Indicadores de WhatsApp" subtitle="Lo que hizo el agente en el mes y cuántas reservas cerró" />

      <div className="inline-flex items-center gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-brand-white">
        <button onClick={() => setMes(mover(mes, -1))} aria-label="Mes anterior" className="rounded-lg p-2 text-brand-gray hover:bg-brand-blue/10 hover:text-brand-blue"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-[9rem] text-center text-sm font-semibold capitalize text-brand-dark">{nombreMes(mes)}</span>
        <button onClick={() => setMes(mover(mes, 1))} disabled={mes >= mesActual()} aria-label="Mes siguiente" className="rounded-lg p-2 text-brand-gray hover:bg-brand-blue/10 hover:text-brand-blue disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
      </div>

      {creditos?.activo && (
        <Panel title="Créditos de WhatsApp" subtitle="Mensajes que envía re-booking por WhatsApp (recordatorios). Responder a tus clientes no gasta créditos">
          <div className="mb-2 flex items-baseline justify-between"><span className="text-sm text-brand-gray">Este mes: {creditos.usadosMes} de {creditos.incluidosMes} usados</span><span className="text-sm font-bold text-brand-dark">{creditos.disponibles} disponibles</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-brand-blue/10"><div className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-accent" style={{ width: `${creditos.incluidosMes > 0 ? Math.min(100, Math.round((creditos.usadosMes / creditos.incluidosMes) * 100)) : 100}%` }} /></div>
          {creditos.restantesPacks > 0 && <p className="mt-2 text-xs text-brand-gray">Además tienes {creditos.restantesPacks} créditos de packs comprados.</p>}
        </Panel>
      )}

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {!datos && !error && <p className="text-sm text-brand-gray">Cargando…</p>}

      {a && p && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tarjeta destacada icono={<CalendarCheck className="h-4 w-4" />} titulo="Reservas cerradas" valor={a.reservas_cerradas} pie={<Variacion ahora={a.reservas_cerradas} antes={p.reservas_cerradas} />} />
            <Tarjeta icono={<Percent className="h-4 w-4" />} titulo="Conversión" valor={a.conversion_pct === null ? "—" : `${a.conversion_pct}%`} pie={<span className="text-xs text-brand-gray">de las ofertas terminó en reserva</span>} />
            <Tarjeta icono={<MessageCircle className="h-4 w-4" />} titulo="Consultas atendidas" valor={a.consultas_disponibilidad + a.respuestas_automaticas} pie={<Variacion ahora={a.consultas_disponibilidad + a.respuestas_automaticas} antes={p.consultas_disponibilidad + p.respuestas_automaticas} />} />
            <Tarjeta icono={<UserRound className="h-4 w-4" />} titulo="Derivadas a una persona" valor={a.derivadas_persona} pie={<Variacion ahora={a.derivadas_persona} antes={p.derivadas_persona} />} />
          </div>

          <Panel title="Del mensaje a la reserva" subtitle="Cuántos clientes avanzan en cada paso">
            <div className="space-y-4">
              {EMBUDO.map((f, i) => {
                const v = a[f.k];
                const ancho = Math.max(v > 0 ? 4 : 0, Math.round((v / maxEmbudo) * 100));
                return (
                  <div key={f.k}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-brand-dark">{f.t}</span>
                      <span className="text-sm font-bold text-brand-dark">{v}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-brand-blue/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-accent transition-all" style={{ width: `${ancho}%`, opacity: 1 - i * 0.12 }} />
                    </div>
                    <p className="mt-1 text-xs text-brand-gray">{f.ayuda}</p>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title={`${nombreMes(a.mes)} frente a ${nombreMes(p.mes)}`} subtitle="Barra oscura: este mes. Barra clara: el mes anterior">
            <div className="space-y-4">
              {COMPARAR.map((f) => {
                const mx = Math.max(1, a[f.k], p[f.k]);
                return (
                  <div key={f.k}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-brand-dark">{f.t}</span>
                      <span className="text-xs text-brand-gray"><b className="text-sm text-brand-dark">{a[f.k]}</b> · antes {p[f.k]}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2.5 overflow-hidden rounded-full bg-brand-blue/10"><div className="h-full rounded-full bg-brand-blue" style={{ width: `${(a[f.k] / mx) * 100}%` }} /></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-brand-blue/10"><div className="h-full rounded-full bg-brand-accent/50" style={{ width: `${(p[f.k] / mx) * 100}%` }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Detalle" flush>
            <table className="w-full text-sm">
              <thead><tr className="bg-brand-blue/5 text-left text-xs text-brand-gray"><th className="px-4 py-2 font-semibold">Indicador</th><th className="px-4 py-2 text-right font-semibold capitalize">{nombreMes(a.mes)}</th><th className="px-4 py-2 text-right font-semibold capitalize">{nombreMes(p.mes)}</th></tr></thead>
              <tbody>
                {[...COMPARAR.slice(0, 1), ...EMBUDO.map((e) => ({ k: e.k, t: e.t })), ...COMPARAR.slice(3)].map((f) => (
                  <tr key={f.k} className="border-t border-gray-100 dark:border-white/10">
                    <td className="px-4 py-2.5 text-brand-dark">{f.t}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-brand-dark">{a[f.k]}</td>
                    <td className="px-4 py-2.5 text-right text-brand-gray">{p[f.k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </div>
  );
}
