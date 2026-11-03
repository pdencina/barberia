"use client";

import { useEffect, useState } from "react";
import { PageHeader, Panel } from "@/components/ui/premium";

interface Periodo { mes: string; respuestas_automaticas: number; consultas_disponibilidad: number; ofertas_horas: number; reservas_iniciadas: number; reservas_cerradas: number; derivadas_persona: number; citas_whatsapp: number; citas_completadas: number; citas_canceladas: number; conversion_pct: number | null }
const FILAS: { k: keyof Periodo; t: string }[] = [
  { k: "respuestas_automaticas", t: "Preguntas respondidas solas" },
  { k: "consultas_disponibilidad", t: "Consultas de disponibilidad" },
  { k: "ofertas_horas", t: "Veces que se ofrecieron horas" },
  { k: "reservas_iniciadas", t: "Reservas iniciadas" },
  { k: "reservas_cerradas", t: "Reservas cerradas por WhatsApp" },
  { k: "derivadas_persona", t: "Derivadas a una persona" },
  { k: "citas_completadas", t: "Citas de WhatsApp realizadas" },
  { k: "citas_canceladas", t: "Citas de WhatsApp canceladas" },
];
const mesActual = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 7);
const mover = (m: string, n: number) => { const [y, mm] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mm - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

export default function WhatsappIndicadoresPage() {
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

  return (
    <div className="space-y-4">
      <PageHeader title="Indicadores de WhatsApp" subtitle="Lo que hizo el agente en el mes y cuántas reservas cerró" />
      <div className="flex items-center gap-3">
        <button onClick={() => setMes(mover(mes, -1))} className="rounded-lg border px-3 py-1 text-sm">←</button>
        <span className="text-sm font-semibold">{mes}</span>
        <button onClick={() => setMes(mover(mes, 1))} disabled={mes >= mesActual()} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40">→</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {datos && (
        <Panel>
          <div className="mb-4 rounded-xl bg-brand-blue/10 p-4">
            <p className="text-xs text-brand-gray">Reservas cerradas por WhatsApp</p>
            <p className="text-3xl font-bold text-brand-dark">{datos.actual.reservas_cerradas}</p>
            <p className="text-xs text-brand-gray">{datos.actual.conversion_pct === null ? "Sin ofertas de horas aún" : `${datos.actual.conversion_pct}% de las veces que se ofrecieron horas terminó en reserva`}</p>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-brand-gray"><th className="py-1">Indicador</th><th className="py-1 text-right">{datos.actual.mes}</th><th className="py-1 text-right">{datos.anterior.mes}</th></tr></thead>
            <tbody>
              {FILAS.map((f) => (
                <tr key={f.k} className="border-t border-gray-100 dark:border-white/10">
                  <td className="py-2">{f.t}</td>
                  <td className="py-2 text-right font-semibold">{datos.actual[f.k] as number}</td>
                  <td className="py-2 text-right text-brand-gray">{datos.anterior[f.k] as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
