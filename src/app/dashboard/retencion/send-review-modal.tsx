"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, MessageCircle, Search, AlertTriangle } from "lucide-react";
import { primaryButton, ghostButton, inputClass } from "@/components/ui/premium";

export interface ReviewRecipient {
  id: string;
  name: string;
  contact: string | null;
  /** Si ya recibio una campana hace poco: cuando y con que cupon (para no repetirle lo mismo). */
  last?: { at: string; coupon: string | null } | null;
}

const fechaCorta = (iso: string) => new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" }).format(new Date(iso));

// Cuadro para revisar un envio masivo ANTES de enviarlo (Email masivo y lista de difusion de WhatsApp):
// resumen claro, lista completa de destinatarios y la posibilidad de sacar a alguien en ese momento.
export function SendReviewModal({
  kind,
  recipients,
  couponLabel,
  messageText,
  skippedOptedOut,
  truncated,
  defaultName,
  recentDays,
  onCancel,
  onConfirm,
}: {
  kind: "email" | "whatsapp";
  recipients: ReviewRecipient[];
  couponLabel: string | null;
  messageText: string;
  /** Clientes agregados a mano que se dejaron fuera porque pidieron no recibir promociones. */
  skippedOptedOut: number;
  /** La lista se corto en pantalla (muy larga): igual se envia a todos los marcados. */
  truncated: boolean;
  /** Nombre sugerido para la campana (se puede cambiar). */
  defaultName: string;
  /** Ventana (en dias) de "ya recibio una campana hace poco". */
  recentDays: number;
  onCancel: () => void;
  /** Recibe los ids que se desmarcaron en este cuadro (se suman a los que ya estaban desmarcados) y el nombre de la campana. */
  onConfirm: (extraExcludedIds: string[], campaignName: string) => void;
}) {
  const [off, setOff] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [name, setName] = useState(defaultName);
  const nameRef = useRef<HTMLInputElement>(null);

  // Al abrir, el cursor queda en el nombre (seleccionado) para poder escribir otro de inmediato.
  useEffect(() => { nameRef.current?.focus(); nameRef.current?.select(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const total = recipients.length;
  const count = total - off.size;
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (q ? recipients.filter((r) => r.name.toLowerCase().includes(q) || (r.contact || "").toLowerCase().includes(q)) : recipients),
    [recipients, q]
  );
  const isEmail = kind === "email";
  const Icon = isEmail ? Mail : MessageCircle;
  const toggle = (id: string) => setOff((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setOff(count === total ? new Set(recipients.map((r) => r.id)) : new Set());
  // Clientes que ya recibieron una campana hace poco (y siguen marcados): se pueden sacar de un clic.
  const already = recipients.filter((r) => r.last).length;
  const alreadyOn = recipients.filter((r) => r.last && !off.has(r.id)).length;
  const removeAlready = () => setOff((prev) => { const n = new Set(prev); recipients.forEach((r) => { if (r.last) n.add(r.id); }); return n; });
  const nameOk = name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="revision-titulo" className="flex max-h-[90vh] w-full max-w-lg animate-scale-in flex-col rounded-2xl bg-white shadow-xl">
        {/* Encabezado */}
        <div className="flex items-start gap-3 px-5 pb-3 pt-5 md:px-6 md:pt-6">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h2 id="revision-titulo" className="text-lg font-bold tracking-tight text-brand-dark">
              {isEmail ? `Enviar ${count} correo${count === 1 ? "" : "s"}` : `Copiar ${count} contacto${count === 1 ? "" : "s"} para difusión`}
            </h2>
            <p className="text-sm text-brand-gray">Revisa a quién le llegará. Puedes sacar a alguien aquí mismo.</p>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 pb-2 md:px-6">
          {/* Nombre de la campana: para distinguirla despues en "Campañas enviadas" */}
          <div>
            <label htmlFor="campana-nombre" className="mb-1.5 block text-xs font-semibold text-brand-gray">Nombre de la campaña</label>
            <input
              id="campana-nombre"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Ej: Campaña octubre semana 3 / 30-45 días"
              className={`${inputClass} ${nameOk ? "" : "border-red-300 focus:border-red-400 focus:ring-red-100"}`}
            />
            <p className={`mt-1 text-[11px] ${nameOk ? "text-brand-gray" : "font-semibold text-red-500"}`}>
              {nameOk ? "Solo para ti: sirve para reconocerla después en Campañas enviadas." : "Ponle un nombre para poder distinguirla después."}
            </p>
          </div>

          {/* Resumen */}
          <div className="rounded-xl border border-gray-100 bg-brand-light/60 p-3.5 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-gray">Mensaje</p>
            <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-brand-dark">{messageText}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {couponLabel ? (
                <span className="inline-flex items-center rounded-full border border-brand-blue/30 bg-brand-blue/10 px-3 py-1 text-xs font-bold text-brand-blue">Cupón: {couponLabel}</span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-brand-gray">Sin cupón</span>
              )}
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-brand-gray">
                {isEmail ? `Gasta ${count} del cupo de correos` : `Gasta ${count} del cupo de WhatsApp`}
              </span>
            </div>
          </div>

          {skippedOptedOut > 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} />
              {skippedOptedOut === 1 ? "1 cliente que agregaste no recibirá el mensaje" : `${skippedOptedOut} clientes que agregaste no recibirán el mensaje`}: pidió{skippedOptedOut === 1 ? "" : "n"} no recibir promociones.
            </p>
          )}

          {already > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800">
              <p className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} />
                {already === 1 ? "1 cliente ya recibió" : `${already} clientes ya recibieron`} una campaña en los últimos {recentDays} días.
              </p>
              {alreadyOn > 0 ? (
                <button type="button" onClick={removeAlready} className="mt-1.5 font-bold text-amber-900 underline underline-offset-2 hover:no-underline">
                  Sacar a {alreadyOn === 1 ? "el que ya recibió" : `los ${alreadyOn} que ya recibieron`}
                </button>
              ) : (
                <p className="mt-1 font-medium">Ya los sacaste de este envío.</p>
              )}
            </div>
          )}

          {/* Destinatarios */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-brand-dark">Destinatarios <span className="font-semibold text-brand-gray">({count} de {total})</span></p>
              <button type="button" onClick={toggleAll} className="text-xs font-semibold text-brand-blue hover:underline">
                {count === total ? "Quitar a todos" : "Marcar a todos"}
              </button>
            </div>
            {total > 8 && (
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" strokeWidth={1.75} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en esta lista…" className={`${inputClass} pl-9`} />
              </div>
            )}
            <ul className="max-h-60 divide-y divide-gray-50 overflow-y-auto rounded-xl border border-gray-100">
              {visible.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-brand-gray">Nadie coincide con la búsqueda.</li>
              ) : visible.map((r) => {
                const on = !off.has(r.id);
                return (
                  <li key={r.id}>
                    <label className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-brand-blue/[0.04] ${on ? "" : "opacity-50"}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(r.id)} className="h-4 w-4 flex-shrink-0 cursor-pointer accent-gray-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold capitalize text-brand-dark">{r.name}</span>
                        <span className="block truncate text-xs text-brand-gray">{r.contact || "—"}</span>
                      </span>
                      {r.last && (
                        <span className="flex-shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700" title={r.last.coupon ? `Cupón: ${r.last.coupon}` : "Recibió una campaña"}>
                          Recibió el {fechaCorta(r.last.at)}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
            {truncated && <p className="mt-1.5 text-xs text-brand-gray">Se muestran los primeros {total}. El envío incluye a todos los marcados.</p>}
          </div>
        </div>

        {/* Pie */}
        <div className="mt-2 border-t border-gray-100 px-5 py-4 md:px-6">
          <p className="mb-3 text-xs text-brand-gray">Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className={ghostButton}>Cancelar</button>
            <button type="button" disabled={count === 0 || !nameOk} onClick={() => onConfirm(Array.from(off), name.trim())} className={primaryButton}>
              {count === 0 ? "No hay nadie marcado" : !nameOk ? "Falta el nombre" : isEmail ? `Sí, enviar ${count}` : `Sí, copiar ${count}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
