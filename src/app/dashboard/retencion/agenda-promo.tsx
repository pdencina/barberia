"use client";

import { useEffect, useState } from "react";
import { CalendarSearch, Check } from "lucide-react";
import { avisosAgenda, demandaDe, type ProAgenda } from "@/lib/agenda-promo";
import type { CondicionesPromo } from "@/lib/promo-condiciones";

const dia = (d: string) => d.split("-").reverse().join("/");
const ETIQUETA = { alta: ["Mucha demanda", "bg-red-50 text-red-700", "bg-red-500"], media: ["Normal", "bg-amber-50 text-amber-800", "bg-amber-500"], baja: ["Poca demanda", "bg-emerald-50 text-emerald-700", "bg-emerald-500"] } as const;

// Muestra la agenda de cada profesional en los días de la promoción y recomienda. Solo informa: la decisión es del negocio.
export function AgendaPromo({ value, tenantId, onToggle }: { value: CondicionesPromo; tenantId?: string; onToggle: (id: string, name: string) => void }) {
  const [datos, setDatos] = useState<{ desde: string; hasta: string; porDefecto: boolean; pros: ProAgenda[] } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setCargando(true); setError("");
    const q = new URLSearchParams({ desde: value.desde, hasta: value.hasta, horaDesde: value.horaDesde, horaHasta: value.horaHasta, ...(tenantId ? { tenantId } : {}) });
    fetch(`/api/retention/agenda-promo?${q}`)
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "No se pudo revisar la agenda"); return d; })
      .then((d) => { if (vigente) setDatos(d); })
      .catch((e) => { if (vigente) { setDatos(null); setError(e.message); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [abierto, value.desde, value.hasta, value.horaDesde, value.horaHasta, tenantId]);

  const marcados = value.profesionalIds || [];
  const avisos = datos ? avisosAgenda(datos.pros, marcados) : [];
  const maximo = Math.max(1, ...(datos?.pros || []).map((p) => p.cortes));

  return (
    <div className="mt-3">
      <button type="button" onClick={() => setAbierto((x) => !x)} aria-expanded={abierto}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue px-3.5 py-1.5 text-xs font-semibold text-brand-blue">
        <CalendarSearch className="h-3.5 w-3.5" /> {abierto ? "Ocultar agenda" : "Ver cómo está su agenda"}
      </button>
      {abierto && (
        <div className="mt-2 space-y-2 rounded-xl border border-gray-200 p-3">
          {cargando && <p className="text-xs text-brand-gray">Revisando agendas…</p>}
          {error && <p className="text-xs font-medium text-amber-700">{error}</p>}
          {datos && !cargando && (
            <>
              <p className="text-[11px] text-brand-gray">
                {datos.porDefecto ? "Sin fecha de término: " : ""}del {dia(datos.desde)} al {dia(datos.hasta)}
                {value.horaDesde || value.horaHasta ? `, ${value.horaDesde || "inicio"} a ${value.horaHasta || "cierre"}` : ""}. La barra muestra los cortes y servicios cobrados en las últimas 4 semanas.
              </p>
              {avisos.length > 0 ? (
                <ul className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  {avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              ) : <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">No hay nada que advertir con tu selección.</p>}
              <ul className="space-y-1">
                {datos.pros.map((p) => {
                  const on = marcados.includes(p.id);
                  const [texto, pastilla, barra] = ETIQUETA[demandaDe(p, datos.pros)];
                  return (
                    <li key={p.id}>
                      <button type="button" aria-pressed={on} onClick={() => onToggle(p.id, p.name)} className="flex w-full items-start gap-2 rounded-lg px-1.5 py-2 text-left hover:bg-gray-50">
                        <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${on ? "border-brand-blue bg-brand-blue text-white" : "border-gray-300"}`}>{on && <Check className="h-3 w-3" />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold text-brand-dark">{p.name}</span>
                            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${pastilla}`}>{texto}</span>
                          </span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-100"><span className={`block h-full ${barra}`} style={{ width: `${Math.round((p.cortes / maximo) * 100)}%` }} /></span>
                          <span className="mt-1 block text-[11px] text-brand-gray">
                            <b className="text-brand-dark">{p.cortes}</b> en 4 semanas{p.dias ? ` (${(p.cortes / p.dias).toFixed(1).replace(".", ",")} por día trabajado)` : ""} · {p.atiende ? <><b className="text-brand-dark">{p.reservas}</b> {p.reservas === 1 ? "reserva" : "reservas"} en estos días</> : "sin horario en estos días"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-brand-gray">Es solo una recomendación: toca un nombre para marcarlo o desmarcarlo.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
