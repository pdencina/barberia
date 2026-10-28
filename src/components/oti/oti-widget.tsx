"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Send, ArrowRight, LifeBuoy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { todayInChile } from "@/lib/utils";
import { SUPPORT_AREAS } from "@/lib/support";
import { buscarAyuda } from "@/lib/oti/buscar";
import { entenderBloqueo, etiquetaFecha, type MiembroEquipo, type PedidoBloqueo } from "@/lib/oti/bloqueo";
import { CATALOGO, type EntradaOti } from "@/lib/oti/catalogo";
import { norm } from "@/lib/oti/texto";

type Mensaje =
  | { de: "oti"; tipo: "texto"; texto: string }
  | { de: "yo"; tipo: "texto"; texto: string }
  | { de: "oti"; tipo: "ayuda"; entrada: EntradaOti }
  | { de: "oti"; tipo: "confirmar"; pedido: Extract<PedidoBloqueo, { ok: true }>; estado: "pendiente" | "hecho" | "cancelado" }
  | { de: "oti"; tipo: "soporte"; pregunta: string }
  | { de: "oti"; tipo: "opciones"; opciones: { texto: string; ayuda?: EntradaOti; relleno?: string; soporte?: string }[] };

const SUGERENCIAS = ["Cierra mañana mi agenda", "¿Cómo agrego MercadoPago?", "¿Cómo cambio el precio de un servicio?"];
// Ejemplos de pedidos de cierre: se muestran mientras la persona escribe algo parecido.
const EJEMPLOS_CIERRE = ["Cierra mañana mi agenda", "Cierra el domingo mi agenda", "Cierra del 28 al 30 de octubre mi agenda"];
const PARECE_CIERRE = /\b(cier|cerr|bloq|ausent|libre|no (?:voy|atiend|trabaj))/;
const SALUDO: Mensaje = { de: "oti", tipo: "texto", texto: "¡Hola! Soy Oti y aún estoy en desarrollo, así que puedo cometer errores. Te ayudo con tareas pequeñas del panel: te explico dónde está algo y te abro la pantalla, o cierro días de un profesional si me lo pides. Solo sé lo que hay en re-booking; si no lo sé, te ayudo a avisar a soporte." };

const falta = (r: Extract<PedidoBloqueo, { ok: false }>): string => {
  switch (r.falta) {
    case "profesional": return "¿Para qué profesional? Escribe su nombre, por ejemplo: «cierra mañana a [nombre]», o «cierra mañana mi agenda» si es la tuya.";
    case "ambiguo": return `Hay más de un profesional con ese nombre (${(r.candidatos || []).map((c) => c.name).join(", ")}). Escribe el nombre completo.`;
    case "fecha": return "¿Qué día? Por ejemplo: «mañana», «el domingo», «el 30 de octubre» o «del 28 al 30 de octubre».";
    case "hasta": return "¿Hasta cuándo? Por ejemplo: «hasta el 15 de noviembre».";
    case "pasado": return "Esa fecha ya pasó. Dime una fecha de hoy en adelante.";
    case "rango": return "No entendí el rango de fechas. Prueba: «del 28 al 30 de octubre».";
    case "largo": return "Es un período muy largo para hacerlo desde aquí (máximo 120 días). Dime un período más corto.";
  }
};

// Oti: asistente de tareas pequeñas del panel. Sin IA: busca en un catalogo de ayuda hecho con lo que existe en el sistema y entiende pedidos simples de
// «cerrar dias». No inventa ni sale a internet; si no sabe, ofrece enviar un reporte a soporte. Cualquier cambio pide confirmacion y se hace con los
// permisos de quien lo usa (el servidor valida sesion y negocio).
export function OtiWidget() {
  const { user, effectiveRole, role } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [msgs, setMsgs] = useState<Mensaje[]>([SALUDO]);
  const [equipo, setEquipo] = useState<MiembroEquipo[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [soporte, setSoporte] = useState<{ pregunta: string } | null>(null);
  const fin = useRef<HTMLDivElement>(null);
  const r = effectiveRole || role;

  useEffect(() => { fin.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, abierto, soporte]);

  if (!user || !r || r === "client") return null;

  const cargarEquipo = async (): Promise<MiembroEquipo[]> => {
    if (equipo) return equipo;
    try {
      const res = await fetch("/api/barberos", { cache: "no-store" });
      const d = await res.json();
      const lista: MiembroEquipo[] = Array.isArray(d) ? d.filter((m: any) => m?.id && m?.name).map((m: any) => ({ id: m.id, name: m.name })) : [];
      setEquipo(lista);
      return lista;
    } catch { setEquipo([]); return []; }
  };

  const enviar = async (q: string) => {
    const pregunta = q.trim();
    if (!pregunta || ocupado) return;
    setTexto("");
    setMsgs((m) => [...m, { de: "yo", tipo: "texto", texto: pregunta }]);
    setOcupado(true);
    try {
      // 1) ¿Es un pedido de cerrar dias?
      const pedido = entenderBloqueo(pregunta, todayInChile(), await cargarEquipo(), user.id);
      if (pedido) {
        // Un profesional solo puede cerrar su propia agenda; recepcion, administrador y super admin pueden cerrar la de cualquiera de su negocio.
        if (pedido.ok && r === "barber" && pedido.profesional.id !== user.id) setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "Con tu cuenta solo puedes cerrar tu propia agenda. Pídele a recepción o al administrador que cierre la de otro profesional." }]);
        else if (pedido.ok) setMsgs((m) => [...m, { de: "oti", tipo: "confirmar", pedido, estado: "pendiente" }]);
        else setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: falta(pedido) }]);
        return;
      }
      // 2) Ayuda
      const res = buscarAyuda(pregunta);
      if (res.length > 0) {
        setMsgs((m) => [...m, { de: "oti", tipo: "ayuda", entrada: res[0].entrada }]);
        return;
      }
      // 3) No se
      // Sin coincidencia clara: ofrece opciones parecidas, un ejemplo para cerrar días y el reporte a soporte.
      const parecidas = buscarAyuda(pregunta, CATALOGO, 3, 2);
      const opciones: Extract<Mensaje, { tipo: "opciones" }>["opciones"] = parecidas.map((x) => ({ texto: x.entrada.titulo, ayuda: x.entrada }));
      if (PARECE_CIERRE.test(norm(pregunta)) || /\b(agenda|dia|dias)\b/.test(norm(pregunta))) opciones.push({ texto: "Cerrar días de un profesional", relleno: "Cierra mañana mi agenda" });
      opciones.push({ texto: "Avisar a soporte", soporte: pregunta });
      setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "No estoy seguro de haber entendido. ¿Quisiste decir alguna de estas?" }, { de: "oti", tipo: "opciones", opciones }]);
    } finally { setOcupado(false); }
  };

  const mostrarAyuda = (entrada: EntradaOti) => setMsgs((m) => [...m, { de: "yo", tipo: "texto", texto: entrada.titulo }, { de: "oti", tipo: "ayuda", entrada }]);

  // Mientras escribe: ideas parecidas (ayudas del catálogo y ejemplos de cierre).
  const t = norm(texto);
  const ideasAyuda = t.length >= 2 ? buscarAyuda(texto, CATALOGO, 3, 2).map((x) => x.entrada) : [];
  const ideasCierre = t.length >= 2 && PARECE_CIERRE.test(t) ? EJEMPLOS_CIERRE : [];

  const confirmar = async (i: number, pedido: Extract<PedidoBloqueo, { ok: true }>) => {
    setOcupado(true);
    try {
      const res = await fetch("/api/barber/blocks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId: pedido.profesional.id, date: pedido.desde, allDay: true, reason: "Cerrado desde Oti",
          ...(pedido.dias > 1 ? { repeat: { freq: "daily", until: pedido.hasta } } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsgs((m) => m.map((x, k) => (k === i && x.tipo === "confirmar" ? { ...x, estado: "cancelado" as const } : x)).concat([
          { de: "oti", tipo: "texto", texto: res.status === 403 || res.status === 401 ? "No tienes permiso para hacer ese cambio con tu cuenta." : `No pude hacerlo: ${d?.error || "intenta de nuevo"}.` },
          { de: "oti", tipo: "soporte", pregunta: `Oti no pudo bloquear a ${pedido.profesional.name} del ${pedido.desde} al ${pedido.hasta}: ${d?.error || res.status}` },
        ]));
        return;
      }
      setMsgs((m) => m.map((x, k) => (k === i && x.tipo === "confirmar" ? { ...x, estado: "hecho" as const } : x)).concat([
        { de: "oti", tipo: "texto", texto: `Listo. Dejé ${pedido.dias === 1 ? "cerrado el día" : `cerrados ${pedido.dias} días`} de ${pedido.profesional.name}. Lo ves en el Calendario.` },
      ]));
      showToast("Bloqueo creado", "success");
    } catch {
      setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "No pude conectar. Revisa tu conexión e intenta de nuevo." }]);
    } finally { setOcupado(false); }
  };

  return (
    <>
      {!abierto && (
        <button type="button" onClick={() => setAbierto(true)} aria-label="Abrir Oti, tu asistente"
          className="fixed z-40 right-4 max-lg:bottom-[calc(9.5rem+env(safe-area-inset-bottom,0px))] lg:right-5 lg:bottom-24 h-14 w-14 overflow-hidden rounded-full border-2 border-brand-blue bg-white shadow-lg shadow-black/20 transition-transform hover:scale-105">
          <img src="/oti.webp" alt="Oti" className="h-full w-full object-cover" />
        </button>
      )}
      {abierto && (
        <div className="fixed inset-0 z-[70] flex items-end justify-end bg-black/30 p-0 sm:items-end sm:p-5" onClick={() => setAbierto(false)}>
          <div onClick={(e) => e.stopPropagation()} className="flex h-[min(34rem,88vh)] w-full flex-col overflow-hidden rounded-t-3xl border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:w-[24rem] sm:rounded-3xl">
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <img src="/oti.webp" alt="" className="h-10 w-10 rounded-full border border-brand-blue/30 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brand-dark dark:text-gray-100">Oti</p>
                <p className="text-[11px] text-brand-gray">Asistente de tareas pequeñas</p>
              </div>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="rounded-full p-2 text-brand-gray hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {msgs.map((m, i) => {
                if (m.tipo === "texto") return (
                  <div key={i} className={`flex ${m.de === "yo" ? "justify-end" : "justify-start"}`}>
                    <p className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${m.de === "yo" ? "bg-brand-blue text-white" : "bg-gray-100 text-brand-dark dark:bg-gray-800 dark:text-gray-100"}`}>{m.texto}</p>
                  </div>
                );
                if (m.tipo === "ayuda") return (
                  <div key={i} className="max-w-[92%] space-y-2 rounded-2xl bg-gray-100 px-3 py-3 text-sm text-brand-dark dark:bg-gray-800 dark:text-gray-100">
                    <p className="font-bold">{m.entrada.titulo}</p>
                    <p>{m.entrada.resumen}</p>
                    <p className="text-[11px] text-brand-gray">Disponible para: {m.entrada.para}</p>
                    {m.entrada.pasos && <ol className="list-decimal space-y-1 pl-5 text-[13px]">{m.entrada.pasos.map((p, k) => <li key={k}>{p}</li>)}</ol>}
                    {m.entrada.ruta && (
                      <button type="button" onClick={() => { router.push(m.entrada.ruta!); setAbierto(false); }}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white">
                        Abrir pantalla <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
                if (m.tipo === "confirmar") return (
                  <div key={i} className="max-w-[92%] space-y-2 rounded-2xl border border-brand-blue/30 bg-white px-3 py-3 text-sm dark:bg-gray-900">
                    <p className="font-bold text-brand-dark dark:text-gray-100">¿Confirmas?</p>
                    <p className="text-brand-dark dark:text-gray-200">
                      Voy a cerrar la agenda de <b>{m.pedido.profesional.name}</b>{" "}
                      {m.pedido.dias === 1 ? <>el <b>{etiquetaFecha(m.pedido.desde)}</b> (día completo).</> : <>desde el <b>{etiquetaFecha(m.pedido.desde)}</b> hasta el <b>{etiquetaFecha(m.pedido.hasta)}</b> ({m.pedido.dias} días completos).</>}
                    </p>
                    {m.estado === "pendiente" ? (
                      <div className="flex gap-2">
                        <button type="button" disabled={ocupado} onClick={() => confirmar(i, m.pedido)} className="rounded-xl bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Sí, cerrar</button>
                        <button type="button" disabled={ocupado} onClick={() => setMsgs((x) => x.map((y, k) => (k === i && y.tipo === "confirmar" ? { ...y, estado: "cancelado" as const } : y)).concat([{ de: "oti", tipo: "texto", texto: "Listo, no hice nada." }]))} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-brand-gray">Cancelar</button>
                      </div>
                    ) : <p className="text-xs text-brand-gray">{m.estado === "hecho" ? "Hecho." : "Sin cambios."}</p>}
                  </div>
                );
                if (m.tipo === "opciones") return (
                  <div key={i} className="flex flex-col items-start gap-2">
                    {m.opciones.map((o, k) => (
                      <button key={k} type="button" disabled={ocupado}
                        onClick={() => { if (o.ayuda) mostrarAyuda(o.ayuda); else if (o.relleno) setTexto(o.relleno); else if (o.soporte) setSoporte({ pregunta: o.soporte }); }}
                        className="rounded-xl border border-brand-blue/40 px-3 py-1.5 text-left text-xs font-semibold text-brand-blue">{o.soporte ? "🛟 " : ""}{o.texto}</button>
                    ))}
                  </div>
                );
                return (
                  <div key={i}>
                    <button type="button" onClick={() => setSoporte({ pregunta: m.pregunta })} className="inline-flex items-center gap-1.5 rounded-xl border border-brand-blue/40 px-3 py-1.5 text-xs font-semibold text-brand-blue">
                      <LifeBuoy className="h-3.5 w-3.5" /> Preparar reporte para soporte
                    </button>
                  </div>
                );
              })}
              {soporte && <ReporteSoporte pregunta={soporte.pregunta} onCerrar={() => setSoporte(null)} onEnviado={() => { setSoporte(null); setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "Listo: envié tu reporte a soporte. Te contactarán al número que dejaste." }]); showToast("Reporte enviado a soporte", "success"); }} />}
              <div ref={fin} />
            </div>

            {msgs.length === 1 && (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {SUGERENCIAS.map((s) => <button key={s} type="button" onClick={() => enviar(s)} className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-semibold text-brand-gray hover:border-brand-blue/40 dark:border-gray-700">{s}</button>)}
              </div>
            )}
            {texto.trim().length >= 2 && (ideasCierre.length > 0 || ideasAyuda.length > 0) && (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {ideasCierre.map((s) => <button key={s} type="button" onClick={() => setTexto(s)} className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-semibold text-brand-gray hover:border-brand-blue/40 dark:border-gray-700">{s}</button>)}
                {ideasAyuda.map((e) => <button key={e.id} type="button" onClick={() => { setTexto(""); mostrarAyuda(e); }} className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-semibold text-brand-gray hover:border-brand-blue/40 dark:border-gray-700">{e.titulo}</button>)}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }} className="flex items-center gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
              <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escríbele a Oti…" maxLength={300}
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-blue focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              <button type="submit" disabled={ocupado || !texto.trim()} aria-label="Enviar" className="rounded-xl bg-brand-blue p-2.5 text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Reporte a soporte: usa el mismo servicio que «Ayuda y soporte» (POST /api/support). Pide lo que ese servicio exige.
function ReporteSoporte({ pregunta, onCerrar, onEnviado }: { pregunta: string; onCerrar: () => void; onEnviado: () => void }) {
  const [area, setArea] = useState<string>("Otro");
  const [phone, setPhone] = useState("");
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-blue focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

  const enviar = async () => {
    setError(null); setEnviando(true);
    try {
      const form = new FormData();
      form.set("area", area);
      form.set("title", `Oti: ${pregunta}`.slice(0, 120));
      form.set("description", `Le escribí a Oti: «${pregunta}» y no pudo resolverlo.${detalle.trim() ? `\n\nDetalle: ${detalle.trim()}` : ""}`);
      form.set("phone", phone);
      form.set("pageUrl", typeof window !== "undefined" ? window.location.pathname : "");
      form.set("userAgent", typeof navigator !== "undefined" ? navigator.userAgent : "");
      const res = await fetch("/api/support", { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d?.error || "No se pudo enviar. Intenta de nuevo."); return; }
      onEnviado();
    } catch { setError("No se pudo enviar. Revisa tu conexión."); } finally { setEnviando(false); }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-gray-200 p-3 text-sm dark:border-gray-700">
      <p className="font-bold text-brand-dark dark:text-gray-100">Reporte para soporte</p>
      <p className="text-xs text-brand-gray">Se enviará lo que me escribiste: «{pregunta}».</p>
      <select className={input} value={area} onChange={(e) => setArea(e.target.value)}>{SUPPORT_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
      <textarea className={input} rows={2} placeholder="Algo más que quieras contarnos (opcional)" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
      <input className={input} inputMode="tel" placeholder="Tu WhatsApp para contactarte" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {error && <p className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={enviando} onClick={enviar} className="rounded-xl bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{enviando ? "Enviando…" : "Enviar a soporte"}</button>
        <button type="button" onClick={onCerrar} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-brand-gray dark:border-gray-700">Cancelar</button>
      </div>
    </div>
  );
}
