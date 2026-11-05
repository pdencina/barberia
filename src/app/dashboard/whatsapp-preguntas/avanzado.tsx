"use client";

import { useEffect, useState } from "react";
import { Copy, Save } from "lucide-react";
import { Panel } from "@/components/ui/premium";

const MAX = 12000;
// Prompt para que el dueño lo use en la IA que ya conoce (ChatGPT, Gemini, Claude, Meta AI...) y obtenga el contexto de su negocio.
export const PROMPT_CONTEXTO = `Actúa como un asistente que documenta negocios de servicios (barberías, peluquerías, kinesiología, estética, etc.) para que un asistente de WhatsApp responda a sus clientes.

MI NEGOCIO: (escribe aquí el nombre, la ciudad y tu sitio web o Instagram)

Usa TODO lo que ya sabes de mi negocio: lo que recuerdes de nuestras conversaciones y lo que encuentres en mi sitio web y mis redes. No me hagas preguntas sobre datos que ya conoces o que puedes encontrar.

QUÉ ENTREGAR: entrégame DE INMEDIATO el informe terminado, sin preguntas previas. Debe ser corto y directo.

FORMATO (el asistente copiará estas líneas tal cual a los clientes):
- Solo preguntas y respuestas, una por línea, con este formato exacto: P: pregunta R: respuesta completa.
- La pregunta escrita como la dice un cliente (por ejemplo "¿Aceptan tarjeta?"). La respuesta empieza con "Sí" o "No" cuando corresponda y se entiende SOLA, repitiendo el nombre del servicio o tema.
- Respuestas de menos de 250 letras. Sin tablas, sin emojis, sin viñetas, sin títulos, sin texto de relleno.
- Enlaces completos y simples (https://...), nunca en formato markdown con corchetes y paréntesis.
- Máximo 40 preguntas y 8.000 caracteres en total.

QUÉ CUBRIR (solo lo que el negocio realmente tenga): dirección y cómo llegar, estacionamiento, cómo reservar y el link, horarios por día y feriados, servicios con precio y duración (agrupa los parecidos en una sola respuesta), profesionales, formas de pago y abonos, cancelaciones y atrasos, ir sin reserva, productos, promociones y beneficios con su fecha de término, cursos o talleres (fecha, precio, cómo inscribirse), redes y contacto.

REGLAS:
- No inventes nada. Si no sabes un dato con certeza, NO lo escribas.
- No incluyas instrucciones sobre el tono ni sobre cómo debe actuar el asistente.
- No incluyas datos que cambian solos (cupos disponibles, "quedan 3 lugares").
- No incluyas datos personales de clientes ni de empleados, solo el nombre de los profesionales.

AL FINAL del informe, separado por una línea con tres guiones (---), escribe una sección llamada DATOS QUE FALTAN con una lista corta de lo que no pude confirmar. Solo ahí me haces preguntas, y solo sobre lo que realmente falta. Cuando te responda, entrégame el informe completo actualizado.`;

export default function Avanzado() {
  const [contexto, setContexto] = useState("");
  const [guardado, setGuardado] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [cargado, setCargado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [iaActiva, setIaActiva] = useState(false);
  const [llave, setLlave] = useState(true);
  const [limite, setLimite] = useState(300);

  useEffect(() => {
    fetch("/api/agente/contexto", { cache: "no-store" }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ ok: false, t: j.error || "No se pudo cargar" }); return; }
      setContexto(j.contexto ?? ""); setGuardado(j.contexto ?? ""); setIaActiva(j.iaActiva === true); setLlave(j.llaveConfigurada !== false); setLimite(j.limiteMensual ?? 300); setCargado(true);
    }).catch(() => setMsg({ ok: false, t: "No se pudo cargar" }));
  }, []);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(PROMPT_CONTEXTO); setMsg({ ok: true, t: "Prompt copiado. Pégalo en tu IA (ChatGPT, Gemini, Claude…)." }); }
    catch { setMsg({ ok: false, t: "No se pudo copiar. Selecciona el texto y cópialo a mano." }); }
  };
  const guardar = async (activar?: boolean) => {
    setGuardando(true); setMsg(null);
    const r = await fetch("/api/agente/contexto", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(typeof activar === "boolean" ? { contexto, iaActiva: activar } : { contexto }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setGuardado(contexto);
      if (typeof activar === "boolean") setIaActiva(activar); else if (contexto.trim().length < 200) setIaActiva(false);
      setMsg({ ok: true, t: typeof activar === "boolean" ? (activar ? "Respuestas con IA activadas." : "Respuestas con IA apagadas.") : "Contexto guardado." });
    } else setMsg({ ok: false, t: j.error || "No se pudo guardar" });
    setGuardando(false);
  };

  return (
    <div className="space-y-4">
      {!llave && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">Falta la llave técnica de la IA en el servidor (la carga el equipo de re-booking). Hasta entonces puedes dejar listo el contexto, pero no responderá.</div>}

      <Panel title="Paso 1: genera el contexto con tu IA" subtitle="Copia este prompt, escribe el nombre de tu negocio donde dice MI NEGOCIO y pégalo en la IA que uses. Te entregará el informe listo, en preguntas y respuestas. Al final te dirá qué datos faltan: respóndele y borra esa sección antes de pegar el resultado.">
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-brand-blue/5 p-3 text-xs text-brand-dark/80">{PROMPT_CONTEXTO}</pre>
        <button onClick={copiar} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white"><Copy className="h-4 w-4" />Copiar prompt</button>
      </Panel>

      <Panel title="Paso 2: pega aquí el resultado" subtitle="Revísalo antes de guardar: el agente solo podrá responder con lo que esté escrito aquí, tal cual. No incluyas datos de clientes ni claves.">
        <textarea value={contexto} onChange={(e) => setContexto(e.target.value)} rows={16} maxLength={MAX} disabled={!cargado} placeholder="P: ¿Dónde queda? R: ...&#10;P: ¿Aceptan tarjeta? R: ..." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent" />
        <div className="mt-2 flex items-center justify-between">
          <span className={`text-xs ${contexto.length > MAX * 0.9 ? "text-red-500" : "text-brand-gray"}`}>{contexto.length}/{MAX}</span>
          <button onClick={() => guardar()} disabled={guardando || !cargado || contexto === guardado} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Save className="h-4 w-4" />Guardar contexto</button>
        </div>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-brand-blue" : "text-red-600"}`}>{msg.t}</p>}
      </Panel>

      <Panel title="Paso 3: activa las respuestas con IA" subtitle={`La IA solo ENTIENDE la pregunta del cliente y elige cuál de tus líneas la responde. No escribe ni inventa nada: la respuesta es tu texto, palabra por palabra. Si ninguna línea responde, o el tema no es de tu negocio, avisa a una persona. Primero responde el modo Clásico. Tope: ${limite} usos de IA al mes.`}>
        <label className="flex items-start gap-3 text-sm text-brand-dark">
          <input type="checkbox" className="mt-1" checked={iaActiva} disabled={!cargado || guardando || (contexto !== guardado)} onChange={(e) => guardar(e.target.checked)} />
          <span><b>Activar la IA para entender mensajes</b>{contexto !== guardado && <span className="block text-xs text-amber-700">Guarda el contexto antes de activar.</span>}</span>
        </label>
        <div className="mt-3 rounded-xl bg-brand-blue/5 p-3 text-xs text-brand-dark/80">
          <b>Aviso de privacidad.</b> Al activarla, el texto de los mensajes que el modo Clásico no puede responder se envía a Anthropic (proveedor de la IA) solo para entender qué pregunta hizo (junto con las líneas de tu contexto). No se guarda el texto de los clientes. Los mensajes con datos como RUT, tarjetas o correos, o sobre salud, reclamos y devoluciones, no se envían: los ve una persona. Recomendamos mencionarlo en tu política de privacidad.
        </div>
      </Panel>
    </div>
  );
}
