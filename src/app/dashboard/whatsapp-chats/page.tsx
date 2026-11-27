"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, ArrowLeft, Bot, UserRound, RefreshCw, Send, Sparkles, Image as ImagenIcono } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/premium";

interface Resumen { conversaciones: number; persona: number; confuso: number; confirmacion: number; consulta: number; confirmacionesEnviadas: number; confirmadas: number; canceladas: number; salud: { clientesNuevos: number; reservasAgente: number; mensajesFallidos: number; enviosFallidos: number; ultimoEntrante: string | null } | null }
type Etiqueta = "persona" | "confuso" | "confirmacion" | "consulta";
const ETIQUETAS: { clave: Etiqueta; titulo: string; corto: string; color: string }[] = [
  { clave: "persona", titulo: "Esperan a una persona", corto: "Responder", color: "bg-red-100 text-red-700" },
  { clave: "confuso", titulo: "No entendidas hoy", corto: "No entendida", color: "bg-amber-100 text-amber-800" },
  { clave: "consulta", titulo: "Dudas y consultas hoy", corto: "Consulta", color: "bg-sky-100 text-sky-800" },
  { clave: "confirmacion", titulo: "De confirmación hoy", corto: "Confirmación", color: "bg-emerald-100 text-emerald-700" },
];
interface Conv { etiquetas?: Etiqueta[]; contacto: string; telefono: string | null; cliente: string | null; total: number; entrantes: number; ultimo: { texto: string; direccion: "entrante" | "saliente"; created_at: string } }
interface Msg { id: string; direccion: "entrante" | "saliente"; tipo: string; texto: string; created_at: string }

const telefonoBonito = (t: string | null) => { if (!t) return "Sin número"; const d = t.replace(/\D/g, ""); return d.startsWith("56") && d.length === 11 ? `+56 ${d[2]} ${d.slice(3, 7)} ${d.slice(7)}` : `+${d}`; };
const hora = (iso: string) => new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const hace = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.floor(m / 60)} h` : `hace ${Math.floor(m / 1440)} d`; };

export default function WhatsappChatsPage() {
  const [convs, setConvs] = useState<Conv[] | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [filtro, setFiltro] = useState<Etiqueta | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [dias, setDias] = useState(14);
  const [error, setError] = useState("");
  const [elegida, setElegida] = useState<Conv | null>(null);
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [guardando, setGuardando] = useState(false);
  const hilo = useRef<HTMLDivElement>(null);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [nuevo, setNuevo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [revision, setRevision] = useState<{ resumen: string; estado: string; alertas: string[] } | null>(null);
  const [revisando, setRevisando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetch("/api/agente/chats", { cache: "no-store" }); const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "No se pudo cargar"); return; }
    setError(""); setConvs(j.conversaciones ?? []); setResumen(j.resumen ?? null); setRegistrando(!!j.registrando); setDias(j.dias ?? 14);
  }, []);
  const cargarHilo = useCallback(async (c: Conv) => {
    const r = await fetch(`/api/agente/chats?contacto=${c.contacto}`, { cache: "no-store" }); const j = await r.json().catch(() => ({}));
    if (r.ok) setMensajes(j.mensajes ?? []);
  }, []);

  useEffect(() => { cargar(); const t = setInterval(cargar, 15000); return () => clearInterval(t); }, [cargar]);
  useEffect(() => { if (!elegida) return; cargarHilo(elegida); const t = setInterval(() => cargarHilo(elegida), 10000); return () => clearInterval(t); }, [elegida, cargarHilo]);
  useEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [mensajes]);

  useEffect(() => { setRevision(null); setAviso(""); setNuevo(""); }, [elegida?.contacto]);
  async function enviar() {
    if (!elegida || !nuevo.trim()) return;
    setEnviando(true); setAviso("");
    const r = await fetch("/api/agente/chats/enviar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacto: elegida.contacto, texto: nuevo }) });
    const j = await r.json().catch(() => ({})); setEnviando(false);
    if (!r.ok) { setAviso(j.error ?? "No se pudo enviar"); return; }
    setNuevo(""); cargarHilo(elegida);
  }
  async function revisar() {
    if (!elegida) return;
    setRevisando(true); setAviso("");
    const r = await fetch("/api/agente/chats/revisar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacto: elegida.contacto }) });
    const j = await r.json().catch(() => ({})); setRevisando(false);
    if (!r.ok) { setAviso(j.error ?? "No se pudo revisar"); return; }
    setRevision(j);
    if (j.respuesta && !nuevo.trim()) setNuevo(j.respuesta);
  }
  async function corregir() {
    if (!nuevo.trim()) return;
    setCorrigiendo(true); setAviso("");
    const r = await fetch("/api/agente/chats/revisar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: nuevo }) });
    const j = await r.json().catch(() => ({})); setCorrigiendo(false);
    if (!r.ok) { setAviso(j.error ?? "No se pudo corregir"); return; }
    setNuevo(j.texto);
  }
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

      {resumen && (
        <Panel title="Resumen de hoy" subtitle="Toca un recuadro para ver solo esas conversaciones">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {ETIQUETAS.map((e) => (
              <button key={e.clave} onClick={() => { setFiltro(filtro === e.clave ? null : e.clave); setElegida(null); }} aria-pressed={filtro === e.clave} className={`rounded-xl border px-3 py-2 text-left ${filtro === e.clave ? "border-brand-blue bg-brand-blue/5" : "border-gray-100 hover:border-brand-blue/40 dark:border-white/10"}`}>
                <p className={`text-2xl font-bold ${e.clave === "persona" && resumen.persona > 0 ? "text-red-600" : "text-brand-dark"}`}>{resumen[e.clave]}</p>
                <p className="text-xs text-brand-gray">{e.titulo}</p>
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-brand-dark">Confirmaciones enviadas: <b>{resumen.confirmacionesEnviadas}</b> · confirmadas: <b>{resumen.confirmadas}</b> · canceladas: <b>{resumen.canceladas}</b></p>
          {resumen.salud && (
            <p className="mt-1 text-sm text-brand-dark">Clientes nuevos: <b>{resumen.salud.clientesNuevos}</b> · reservas del agente: <b>{resumen.salud.reservasAgente}</b> · {resumen.salud.mensajesFallidos + resumen.salud.enviosFallidos === 0 ? <span className="text-emerald-700">sin fallas registradas</span> : <span className="font-semibold text-red-600">{resumen.salud.mensajesFallidos} mensajes sin procesar, {resumen.salud.enviosFallidos} envíos fallidos</span>}{resumen.salud.ultimoEntrante ? ` · último mensaje recibido ${hace(resumen.salud.ultimoEntrante)}` : ""}</p>
          )}
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className={`${elegida ? "hidden lg:block" : ""}`}>
          <Panel title="Conversaciones" subtitle={convs ? (filtro ? `${ETIQUETAS.find((e) => e.clave === filtro)?.titulo} · toca de nuevo el recuadro para ver todas` : `${convs.length} en los últimos ${dias} días`) : "Cargando…"}>
            {convs && convs.length === 0 && <p className="py-6 text-center text-sm text-brand-gray">Todavía no hay conversaciones guardadas.</p>}
            <div className="-mx-2 max-h-[60vh] space-y-1 overflow-y-auto px-2">
              {filtro && convs && !convs.some((c) => c.etiquetas?.includes(filtro)) && <p className="py-6 text-center text-sm text-brand-gray">No hay ninguna.</p>}
              {(convs ?? []).filter((c) => !filtro || c.etiquetas?.includes(filtro)).map((c) => (
                <button key={c.contacto} onClick={() => setElegida(c)} className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${elegida?.contacto === c.contacto ? "border-brand-blue bg-brand-blue/5" : "border-gray-100 hover:border-brand-blue/40 dark:border-white/10"}`}>
                  <div className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold text-brand-dark">{c.cliente ?? telefonoBonito(c.telefono)}</span><span className="flex-shrink-0 text-[11px] text-brand-gray">{hace(c.ultimo.created_at)}</span></div>
                  {c.cliente && <p className="text-[11px] text-brand-gray">{telefonoBonito(c.telefono)}</p>}
                  <p className="mt-0.5 truncate text-xs text-brand-gray">{c.ultimo.direccion === "saliente" ? "🤖 " : ""}{c.ultimo.texto}</p>
                  {c.etiquetas && c.etiquetas.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{ETIQUETAS.filter((e) => c.etiquetas?.includes(e.clave)).map((e) => <span key={e.clave} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.color}`}>{e.corto}</span>)}</div>}
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
                <div className="mb-2 flex justify-end"><button onClick={revisar} disabled={revisando} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-brand-dark hover:border-brand-blue/50 disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" />{revisando ? "Revisando…" : "Revisar con IA"}</button></div>
                {revision && (
                  <div className={`mb-2 rounded-xl border px-3 py-2 text-sm ${revision.estado === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : revision.estado === "urgente" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                    <p className="font-semibold">{revision.estado === "ok" ? "Todo bien" : revision.estado === "urgente" ? "Urgente" : "Revisar"}</p>
                    <p className="mt-0.5">{revision.resumen}</p>
                    {revision.alertas.length > 0 && <ul className="mt-1 list-disc pl-5">{revision.alertas.map((a, i) => <li key={i}>{a}</li>)}</ul>}
                  </div>
                )}
                <div ref={hilo} className="max-h-[45vh] space-y-2 overflow-y-auto rounded-xl bg-gray-50 p-3 dark:bg-black/20">
                  {mensajes.map((m) => {
                    const agente = m.direccion === "saliente";
                    const manual = agente && m.texto.startsWith("[manual] ");
                    const texto = manual ? m.texto.slice(9) : m.texto;
                    return (
                      <div key={m.id} className={`flex ${agente ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${agente ? "bg-brand-blue text-white" : "bg-white text-brand-dark dark:bg-brand-white"}`}>
                          <div className={`mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${agente ? "text-white/70" : "text-brand-gray"}`}>{agente ? <Bot className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}{agente ? (manual ? "Tú" : m.tipo === "plantilla" ? "Confirmación" : "Agente") : "Cliente"}{m.tipo === "boton" ? " · botón" : ""}{m.tipo === "imagen" || m.tipo === "documento" ? <ImagenIcono className="h-3 w-3" /> : null}</div>
                          {texto}
                          <div className={`mt-1 text-right text-[10px] ${agente ? "text-white/60" : "text-brand-gray"}`}>{hora(m.created_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="sticky bottom-0 -mx-1 bg-white px-1 pb-1 pt-1 dark:bg-brand-white">
                {aviso && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{aviso}</p>}
                <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="mt-2 flex gap-2">
                  <textarea value={nuevo} onChange={(e) => setNuevo(e.target.value)} maxLength={1000} rows={3} placeholder="Escribir un mensaje manual…" className="min-w-0 flex-1 resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                  <div className="flex flex-col gap-2">
                  <button type="submit" disabled={enviando || !nuevo.trim()} className="inline-flex items-center gap-1 rounded-xl bg-brand-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" />{enviando ? "…" : "Enviar"}</button>
                  <button type="button" onClick={corregir} disabled={corrigiendo || !nuevo.trim()} className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-brand-dark hover:border-brand-blue/50 disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" />{corrigiendo ? "Corrigiendo…" : "Revisar ortografía"}</button>
                  </div>
                </form>
                <p className="mt-1 text-[11px] text-brand-gray">Solo se puede escribir si el cliente escribió en las últimas 24 horas. El agente puede seguir respondiéndole.</p>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
