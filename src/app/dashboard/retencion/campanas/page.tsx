"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MessageCircle, Megaphone, Send, CalendarClock, ChevronDown, Search, AlertTriangle, Tag } from "lucide-react";
import { PageHeader, StatCard, Panel, ghostButton, inputClass } from "@/components/ui/premium";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";

interface Campaign {
  id: string;
  name: string | null;
  channel: "email" | "whatsapp";
  createdAt: string;
  createdByName: string | null;
  message: string | null;
  couponCode: string | null;
  couponDetail: string | null;
  rangeMinDays: number | null;
  rangeMaxDays: number | null;
  includeNever: boolean;
  plannedTotal: number;
  sentCount: number;
  failedCount: number;
  quotaExceeded: boolean;
  excludedCount: number;
  manualCount: number;
  source: string;
}
interface Recipient { id: string; name: string | null; contact: string | null; status: "sent" | "failed" }

const TZ = "America/Santiago";
const fecha = (iso: string) => new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(new Date(iso));
const hora = (iso: string) => new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(new Date(iso));

function haceCuanto(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "justo ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

const rango = (c: Campaign) =>
  c.rangeMinDays == null ? "—" : c.rangeMaxDays ? `${c.rangeMinDays}–${c.rangeMaxDays} días sin venir` : `${c.rangeMinDays}+ días sin venir`;

export default function CampanasEnviadasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, { loading: boolean; recipients: Recipient[] }>>({});
  const [query, setQuery] = useState("");
  // Buscador de campanas (por nombre, mensaje o cupon). `query` de abajo es el de los destinatarios de la campana abierta.
  const [campaignQuery, setCampaignQuery] = useState("");

  useEffect(() => {
    fetch("/api/retention/campaigns", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { setError(d?.error || "No se pudieron cargar las campañas."); return; }
        setCampaigns(Array.isArray(d.campaigns) ? d.campaigns : []);
        setMigrationMissing(!!d.migrationMissing);
      })
      .catch(() => setError("No se pudieron cargar las campañas."))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    setQuery("");
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!details[id]) {
      setDetails((p) => ({ ...p, [id]: { loading: true, recipients: [] } }));
      fetch(`/api/retention/campaigns/${id}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setDetails((p) => ({ ...p, [id]: { loading: false, recipients: Array.isArray(d?.recipients) ? d.recipients : [] } })))
        .catch(() => setDetails((p) => ({ ...p, [id]: { loading: false, recipients: [] } })));
    }
  };

  const visibleCampaigns = useMemo(() => {
    const q = campaignQuery.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) => [c.name, c.message, c.couponCode, c.couponDetail].some((t) => (t || "").toLowerCase().includes(q)));
  }, [campaigns, campaignQuery]);

  const totals = useMemo(() => ({
    campaigns: campaigns.length,
    sent: campaigns.reduce((n, c) => n + c.sentCount, 0),
    last: campaigns[0]?.createdAt || null,
  }), [campaigns]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6 animate-fade-in">
      <PageHeader
        title="Campañas enviadas"
        subtitle="Lo que ya enviaste a tus clientes, con fecha, mensaje y a quiénes: para no repetir lo mismo."
        actions={
          <Link href="/dashboard/retencion" className={ghostButton}>
            <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Volver a Retención
          </Link>
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <Panel title="No se pudo cargar"><p className="text-sm text-red-500">{error}</p></Panel>
      ) : (
        <>
          {migrationMissing && (
            <p className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} />
              Falta aplicar la migración 115 en la base de datos para que las campañas queden guardadas. Mientras tanto, los envíos funcionan igual pero no quedan registrados.
            </p>
          )}

          {campaigns.length > 0 && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <StatCard label="Campañas enviadas" value={totals.campaigns} Icon={Megaphone} tone="teal" hint="Desde que se registran" />
              <StatCard label="Mensajes enviados" value={totals.sent.toLocaleString("es-CL")} Icon={Send} tone="green" hint="Correos y contactos de difusión" />
              <StatCard label="Última campaña" value={totals.last ? haceCuanto(totals.last) : "—"} Icon={CalendarClock} tone="amber" hint={totals.last ? fecha(totals.last) : undefined} className="col-span-2 md:col-span-1" />
            </div>
          )}

          {campaigns.length === 0 && !migrationMissing ? (
            <Panel title="Aún no hay campañas registradas">
              <div className="flex flex-col items-center px-4 pb-6 pt-2 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
                  <Megaphone className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-semibold text-brand-dark">Desde ahora, cada envío masivo queda guardado aquí.</p>
                <p className="mt-1 max-w-md text-xs text-brand-gray">Verás la fecha, el mensaje, el cupón y a quiénes se les envió. Además, al preparar un nuevo envío, Retención te avisa quiénes ya recibieron una campaña hace poco.</p>
                <Link href="/dashboard/retencion" className={`${ghostButton} mt-4`}>Ir a Retención</Link>
              </div>
            </Panel>
          ) : (
            <div className="space-y-3">
              {campaigns.length > 3 && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" strokeWidth={1.75} />
                  <input value={campaignQuery} onChange={(e) => setCampaignQuery(e.target.value)} placeholder="Buscar una campaña por nombre, mensaje o cupón…" className={`${inputClass} pl-10`} aria-label="Buscar campañas" />
                </div>
              )}
              {visibleCampaigns.length === 0 && <p className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-brand-gray">Ninguna campaña coincide con “{campaignQuery.trim()}”.</p>}
              {visibleCampaigns.map((c) => {
                const open = openId === c.id;
                const d = details[c.id];
                const isEmail = c.channel === "email";
                const Icon = isEmail ? Mail : MessageCircle;
                const incompleto = c.quotaExceeded || c.failedCount > 0 || c.sentCount < c.plannedTotal;
                const q = query.trim().toLowerCase();
                const shown = open && d ? d.recipients.filter((r) => !q || (r.name || "").toLowerCase().includes(q) || (r.contact || "").toLowerCase().includes(q)) : [];
                return (
                  <div key={c.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-brand-white">
                    <button type="button" onClick={() => toggle(c.id)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-brand-blue/[0.03] md:flex-nowrap md:px-5">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="break-words text-sm font-bold text-brand-dark md:text-base">{c.name || (isEmail ? "Email masivo" : "Lista de difusión de WhatsApp")}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <p className="text-xs text-brand-gray">{c.name ? `${isEmail ? "Email masivo" : "Lista de difusión"} · ` : ""}{fecha(c.createdAt)} · {hora(c.createdAt)} · {haceCuanto(c.createdAt)}</p>
                          {c.source === "recuperada" && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-gray" title="Se reconstruyó de los registros de cupo: los destinatarios no quedaron guardados.">Recuperada</span>}
                        </div>
                        <p className="mt-0.5 line-clamp-2 break-words text-sm text-brand-gray">{(c.message || "").replace(/\s*\n+\s*/g, " ") || (isEmail ? "Mensaje por defecto: «Te extrañamos! Vuelve pronto.»" : "Mensaje por defecto: «Te extrañamos! Agenda tu próxima cita.»")}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {c.couponCode ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-brand-blue/30 bg-brand-blue/10 px-2.5 py-0.5 text-xs font-bold text-brand-blue"><Tag className="h-3 w-3" strokeWidth={2.25} /> {c.couponCode}</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-brand-gray">Sin cupón</span>
                          )}
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-brand-gray">{rango(c)}</span>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-3">
                        <div className="text-right">
                          <p className={`text-sm font-bold tabular-nums ${incompleto ? "text-amber-600" : "text-emerald-600"}`}>
                            {c.sentCount} <span className="font-semibold text-brand-gray">de {c.plannedTotal}</span>
                          </p>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-gray">{isEmail ? "enviados" : "contactos"}</p>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-brand-gray transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} />
                      </div>
                    </button>

                    {open && (
                      <div className="space-y-4 border-t border-gray-100 bg-brand-light/40 px-4 py-4 md:px-5">
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-gray">Mensaje enviado</p>
                          <div className="whitespace-pre-line break-words rounded-xl border border-gray-100 bg-white p-3 text-sm text-brand-dark">
                            {c.message || "(mensaje por defecto)"}
                          </div>
                          {c.couponDetail && <p className="mt-2 text-xs text-brand-gray">Cupón incluido: <span className="font-semibold text-brand-dark">{c.couponDetail}</span></p>}
                        </div>

                        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                          {[
                            ["Debían recibirlo", c.plannedTotal],
                            [isEmail ? "Enviados" : "Contactos preparados", c.sentCount],
                            ["Fallidos", c.failedCount],
                            ["Desmarcados antes de enviar", c.excludedCount],
                            ["Agregados a mano", c.manualCount],
                          ].map(([k, v]) => (
                            <div key={String(k)} className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                              <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-gray">{k}</dt>
                              <dd className="text-base font-bold tabular-nums text-brand-dark">{v}</dd>
                            </div>
                          ))}
                          <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-gray">Enviada por</dt>
                            <dd className="truncate text-sm font-bold text-brand-dark">{c.createdByName || "—"}</dd>
                          </div>
                        </dl>
                        {c.quotaExceeded && (
                          <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700">
                            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} /> Se cortó porque se agotó el cupo del plan: no todos los clientes recibieron el mensaje.
                          </p>
                        )}
                        {c.includeNever && <p className="text-xs text-brand-gray">Incluía a clientes que nunca han venido.</p>}

                        <div>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-brand-dark">Destinatarios {d && !d.loading ? <span className="font-semibold text-brand-gray">({d.recipients.length})</span> : null}</p>
                            {d && d.recipients.length > 8 && (
                              <div className="relative w-56 max-w-full">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" strokeWidth={1.75} />
                                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" className={`${inputClass} pl-9`} />
                              </div>
                            )}
                          </div>
                          {!d || d.loading ? (
                            <p className="text-sm text-brand-gray">Cargando destinatarios…</p>
                          ) : d.recipients.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-3 text-sm text-brand-gray">Los destinatarios de esta campaña no quedaron registrados.</p>
                          ) : shown.length === 0 ? (
                            <p className="text-sm text-brand-gray">Nadie coincide con la búsqueda.</p>
                          ) : (
                            <ul className="max-h-72 divide-y divide-gray-50 overflow-y-auto rounded-xl border border-gray-100 bg-white">
                              {shown.map((r) => (
                                <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold capitalize text-brand-dark">{r.name || "—"}</p>
                                    <p className="truncate text-xs text-brand-gray">{r.contact || "—"}</p>
                                  </div>
                                  <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${r.status === "sent" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>
                                    {r.status === "sent" ? (isEmail ? "Enviado" : "Preparado") : "Falló"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
