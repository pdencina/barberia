"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, ArrowLeft, Bot, UserRound, RefreshCw, Image as ImagenIcono } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/premium";

interface Conv { contacto: string; telefono: string | null; cliente: string | null; total: number; entrantes: number; ultimo: { texto: string; direccion: "entrante" | "saliente"; created_at: string } }
interface Msg { id: string; direccion: "entrante" | "saliente"; tipo: string; texto: string; created_at: string }

const telefonoBonito = (t: string | null) => { if (!t) return "Sin número"; const d = t.replace(/\D/g, ""); return d.startsWith("56") && d.length === 11 ? `+56 ${d[2]} ${d.slice(3, 7)} ${d.slice(7)}` : `+${d}`; };
const hora = (iso: string) => new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const hace = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.floor(m / 60)} h` : `hace ${Math.floor(m / 1440)} d`; };

export default function WhatsappChatsPage() {
  const [convs, setConvs] = useState<Conv[] | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [dias, setDias] = useState(14);
  const [error, setError] = useState("");
  const [elegida, setElegida] = useState<Conv | null>(null);
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [guardando, setGuardando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    const r = await fetch("/api/agente/chats", { cache: "no-store" }); const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "No se pudo cargar"); return; }
    setError(""); setConvs(j.conversaciones ?? []); setRegistrando(!!j.registrando); setDias(j.dias ?? 14);
  }, []);
  const cargarHilo = useCallback(async (c: Conv) => {
    const r = await fetch(`/api/agente/chats?contacto=${c.contacto}`, { cache: "no-store" }); const j = await r.json().catch(() => ({}));
    if (r.ok) setMensajes(j.mensajes ?? []);
  }, []);

  useEffect(() => { cargar(); const t = setInterval(cargar, 15000); return () => clearInterval(t); }, [cargar]);
  useEffect(() => { if (!elegida) return; cargarHilo(elegida); const t = setInterval(() => cargarHilo(elegida), 10000); return () => clearInterval(t); }, [elegida, cargarHilo]);
  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }); }, [mensajes]);

  async function alternar() {
    setGuardando(true);
    const r = await fetch("/api/agente/chats", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registrar: !registrando }) });
    const j = await r.json().catch(() => ({})); setGuardando(false);
    if (!r.ok) { setError(j.error ?? "No se pudo cambiar"); return; }
    setRegistrando(!!j.registrando); cargar();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Conversaciones de WhatsApp" subtitle="Lo que escriben los clientes y lo que responde el agente" />
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Panel title={registrando ? "Guardando conversaciones" : "El guardado está apagado"} subtitle={`Solo administración las ve. Se borran solas a los ${dias} días.`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${registrando ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}><span className={`h-2 w-2 rounded-full ${registrando ? "bg-emerald-500" : "bg-gray-400"}`} />{registrando ? "Encendido" : "Apagado"}</span>
          <button onClick={alternar} disabled={guardando} className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-semibold text-brand-dark hover:border-brand-blue/50 disabled:opacity-50">{registrando ? "Apagar" : "Encender"}</button>
          <button onClick={cargar} className="ml-auto inline-flex items-center gap-1 text-xs text-brand-gray hover:text-brand-dark"><RefreshCw className="h-3.5 w-3.5" />Actualizar</button>
        </div>
        {!registrando && <p className="mt-2 text-xs text-brand-gray">Al encenderlo se empiezan a guardar los mensajes desde ese momento. Los clientes deberían saber que los atiende un asistente y que la conversación se guarda para mejorar el servicio.</p>}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className={`${elegida ? "hidden lg:block" : ""}`}>
          <Panel title="Conversaciones" subtitle={convs ? `${convs.length} en los últimos ${dias} días` : "Cargando…"}>
            {convs && convs.length === 0 && <p className="py-6 text-center text-sm text-brand-gray">Todavía no hay conversaciones guardadas.</p>}
            <div className="-mx-2 max-h-[60vh] space-y-1 overflow-y-auto px-2">
              {(convs ?? []).map((c) => (
                <button key={c.contacto} onClick={() => setElegida(c)} className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${elegida?.contacto === c.contacto ? "border-brand-blue bg-brand-blue/5" : "border-gray-100 hover:border-brand-blue/40 dark:border-white/10"}`}>
                  <div className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold text-brand-dark">{c.cliente ?? telefonoBonito(c.telefono)}</span><span className="flex-shrink-0 text-[11px] text-brand-gray">{hace(c.ultimo.created_at)}</span></div>
                  {c.cliente && <p className="text-[11px] text-brand-gray">{telefonoBonito(c.telefono)}</p>}
                  <p className="mt-0.5 truncate text-xs text-brand-gray">{c.ultimo.direccion === "saliente" ? "🤖 " : ""}{c.ultimo.texto}</p>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <div className={`${elegida ? "" : "hidden lg:block"}`}>
          <Panel title={elegida ? (elegida.cliente ?? telefonoBonito(elegida.telefono)) : "Conversación"} subtitle={elegida ? telefonoBonito(elegida.telefono) : "Elige una conversación para verla"}>
            {!elegida && <div className="flex flex-col items-center gap-2 py-12 text-brand-gray"><MessageCircle className="h-8 w-8" /><p className="text-sm">Elige una conversación de la lista</p></div>}
            {elegida && (
              <div>
                <button onClick={() => setElegida(null)} className="mb-2 inline-flex items-center gap-1 text-xs text-brand-gray lg:hidden"><ArrowLeft className="h-3.5 w-3.5" />Volver</button>
                <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded-xl bg-gray-50 p-3 dark:bg-black/20">
                  {mensajes.map((m) => {
                    const agente = m.direccion === "saliente";
                    return (
                      <div key={m.id} className={`flex ${agente ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${agente ? "bg-brand-blue text-white" : "bg-white text-brand-dark dark:bg-brand-white"}`}>
                          <div className={`mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${agente ? "text-white/70" : "text-brand-gray"}`}>{agente ? <Bot className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}{agente ? (m.tipo === "plantilla" ? "Confirmación" : "Agente") : "Cliente"}{m.tipo === "boton" ? " · botón" : ""}{m.tipo === "imagen" || m.tipo === "documento" ? <ImagenIcono className="h-3 w-3" /> : null}</div>
                          {m.texto}
                          <div className={`mt-1 text-right text-[10px] ${agente ? "text-white/60" : "text-brand-gray"}`}>{hora(m.created_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={fin} />
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
