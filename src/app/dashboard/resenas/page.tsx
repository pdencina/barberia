"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/premium";
import { Spinner } from "@/components/ui/spinner";
import type { ResumenResenas } from "@/lib/resenas";

type Datos = ResumenResenas & { googleMapsUrl: string | null; googleCount: number | null };
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const nombreMes = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const prom = (n: number) => n.toFixed(2).replace(".", ",");

function Estrellas({ n }: { n: number }) {
  return <span className="inline-flex" aria-label={`${n} de 5`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />)}</span>;
}

// Reseñas de los clientes de tu negocio (las que dejan en «Califica tu experiencia»): cómo han crecido, por profesional y los comentarios. Solo lectura.
export default function ResenasPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/resenas", { cache: "no-store" }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) setError(j?.error || "No se pudieron cargar"); else setD(j); }).catch(() => setError("No se pudieron cargar"));
  }, []);

  const maxMes = Math.max(1, ...(d?.porMes.map((m) => m.cantidad) || [1]));
  const maxDist = Math.max(1, ...(d?.distribucion.map((x) => x.cantidad) || [1]));
  const delta = d ? d.esteMes - d.mesAnterior : 0;

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-5xl animate-fade-in">
      <PageHeader title="Reseñas" subtitle="Lo que opinan tus clientes y cómo ha crecido" />
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {!d && !error && <Spinner />}
      {d && (
        <>
          <Panel title="¿Dónde califican tus clientes?" subtitle="Es a donde los lleva el botón del correo «Gracias por tu visita».">
            {d.googleMapsUrl ? (
              <div className="space-y-1 text-sm">
                <p className="text-brand-dark">Los clientes califican en <b>Google Maps</b>: <a href={d.googleMapsUrl} target="_blank" rel="noreferrer" className="break-all text-brand-blue underline">{d.googleMapsUrl}</a></p>
                <p className="text-xs text-brand-gray">Las reseñas de Google se ven en Google, no aquí{d.googleCount != null ? ` (tienes anotadas ${d.googleCount} en Configuración › Reservas)` : ""}. Abajo ves solo las que se dejaron en la página de re-booking.</p>
              </div>
            ) : (
              <p className="text-sm text-brand-dark">Los clientes califican en la <b>página de re-booking</b> («Califica tu experiencia»). Si quieres llevarlos a Google Maps, pega tu link en <Link href="/dashboard/configuracion/reservas" className="text-brand-blue underline">Configuración › Reservas</Link>.</p>
            )}
          </Panel>

          {d.total === 0 ? (
            <p className="py-8 text-center text-sm text-brand-gray">Aún no hay reseñas en re-booking.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-100 bg-white p-4"><p className="text-xs text-brand-gray">Promedio</p><p className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-brand-dark">{prom(d.promedio)} <Star className="h-5 w-5 fill-amber-400 text-amber-400" /></p><p className="text-xs text-brand-gray">de 5 estrellas</p></div>
                <div className="rounded-2xl border border-gray-100 bg-white p-4"><p className="text-xs text-brand-gray">Reseñas en total</p><p className="mt-1 text-2xl font-extrabold text-brand-dark">{d.total}</p></div>
                <div className="rounded-2xl border border-gray-100 bg-white p-4"><p className="text-xs text-brand-gray">Este mes</p><p className="mt-1 text-2xl font-extrabold text-brand-dark">{d.esteMes}</p><p className={`text-xs ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>{delta >= 0 ? "+" : ""}{delta} vs el mes pasado ({d.mesAnterior})</p></div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Panel title="Cómo ha crecido" subtitle="Reseñas por mes, últimos 12 meses">
                  <div className="flex h-40 items-end gap-1.5">
                    {d.porMes.map((m) => (
                      <div key={m.mes} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${nombreMes(m.mes)}: ${m.cantidad} reseñas${m.cantidad ? `, promedio ${prom(m.promedio)}` : ""}`}>
                        <span className="text-[10px] font-semibold text-brand-dark">{m.cantidad || ""}</span>
                        <div className="w-full rounded-t-md bg-brand-blue" style={{ height: `${m.cantidad ? Math.max(4, (m.cantidad / maxMes) * 100) : 2}%`, opacity: m.cantidad ? 1 : 0.2 }} />
                        <span className="text-[9px] text-brand-gray">{nombreMes(m.mes).slice(0, 3)}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel title="Notas recibidas" subtitle="Cuántas de cada estrella">
                  <div className="space-y-2">
                    {d.distribucion.map((x) => (
                      <div key={x.estrellas} className="flex items-center gap-2 text-xs">
                        <span className="w-6 font-semibold text-brand-dark">{x.estrellas}★</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(x.cantidad / maxDist) * 100}%` }} /></div>
                        <span className="w-8 text-right tabular-nums text-brand-dark">{x.cantidad}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <Panel title="Por profesional">
                <div className="divide-y divide-gray-100">
                  {d.porProfesional.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="font-medium text-brand-dark">{p.nombre}</span>
                      <span className="flex items-center gap-3 text-xs text-brand-gray"><Estrellas n={Math.round(p.promedio)} /> <b className="text-brand-dark">{prom(p.promedio)}</b> · {p.cantidad} reseñas</span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Últimos comentarios">
                <div className="divide-y divide-gray-100">
                  {d.recientes.map((r) => (
                    <div key={r.id} className="py-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-brand-gray"><Estrellas n={r.rating} /> <b className="text-brand-dark">{r.cliente}</b> · para {r.profesional} · {r.fecha.split("-").reverse().join("/")}</div>
                      {r.comment ? <p className="mt-1 text-sm text-brand-dark">{r.comment}</p> : <p className="mt-1 text-xs italic text-brand-gray">Sin comentario</p>}
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  );
}
