"use client";

import { useEffect, useState } from "react";
import { Copy, Save } from "lucide-react";
import { Panel } from "@/components/ui/premium";

const MAX = 12000;
// Prompt para que el dueño lo use en la IA que ya conoce (ChatGPT, Gemini, Claude, Meta AI...) y obtenga el contexto de su negocio.
export const PROMPT_CONTEXTO = `Actúa como un entrevistador experto que documenta negocios de servicios (barberías, peluquerías, kinesiología, estética, etc.) para que un asistente de WhatsApp pueda responder a sus clientes.

Tu tarea: hacerme preguntas, de a pocas por vez, hasta tener TODA la información que un cliente podría preguntar. Cubre estos bloques, en este orden:
1. Datos del negocio: nombre, dirección exacta, cómo llegar (metro, micro, referencias), estacionamiento, teléfono, redes y link de reservas.
2. Horarios: por día, feriados, horario especial.
3. Equipo: profesionales, a qué se dedica cada uno, si atienden mujeres o niños.
4. Servicios: nombre, qué incluye, duración y precio de cada uno; requisitos (por ejemplo largo mínimo de cabello); servicios que NO hacemos.
5. Reservas y políticas: cómo agendar, cambios y cancelaciones (con cuánta anticipación), atrasos, orden de llegada, agendar para dos personas.
6. Pagos: medios aceptados, abonos, devoluciones, descuentos, promociones, convenios.
7. Primera visita, cortesías y beneficios (café, reseña en Google, referidos).
8. Productos que venden (marcas, precios aproximados).
9. Cursos o talleres: fechas, duración, precio, abono, qué incluye, requisitos, edad mínima, certificado, política de devolución.
10. Tono: cómo hablamos con los clientes (formal, cercano, tuteo) y qué temas NO debe responder el asistente (por ejemplo salud, reclamos, devoluciones) y deben pasar a una persona.
11. Las 20 preguntas que más nos hacen los clientes, con su respuesta.

Reglas:
- Pregunta de a 3 o 4 cosas por vez y espera mi respuesta.
- No inventes nada. Si no te doy un dato, escribe "NO DEFINIDO".
- No incluyas datos personales de clientes, contraseñas ni claves.

Cuando yo diga "listo", entrégame el resultado FINAL en texto plano, con estos títulos exactos y en este orden: NEGOCIO, HORARIOS, EQUIPO, SERVICIOS Y PRECIOS, RESERVAS Y POLÍTICAS, PAGOS, BENEFICIOS, PRODUCTOS, CURSOS, TONO Y LÍMITES, PREGUNTAS FRECUENTES (formato "P: ... R: ..."). Máximo 10.000 caracteres, sin tablas ni emojis, frases cortas y concretas.`;

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

      <Panel title="Paso 1: genera el contexto con tu IA" subtitle="Copia este prompt y pégalo en la IA que uses. Te hará preguntas sobre tu negocio y al final te entregará un texto ordenado.">
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-brand-blue/5 p-3 text-xs text-brand-dark/80">{PROMPT_CONTEXTO}</pre>
        <button onClick={copiar} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white"><Copy className="h-4 w-4" />Copiar prompt</button>
      </Panel>

      <Panel title="Paso 2: pega aquí el resultado" subtitle="Revísalo antes de guardar: el agente solo podrá responder lo que esté escrito aquí. No incluyas datos de clientes ni claves.">
        <textarea value={contexto} onChange={(e) => setContexto(e.target.value)} rows={16} maxLength={MAX} disabled={!cargado} placeholder="NEGOCIO&#10;...&#10;HORARIOS&#10;..." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent" />
        <div className="mt-2 flex items-center justify-between">
          <span className={`text-xs ${contexto.length > MAX * 0.9 ? "text-red-500" : "text-brand-gray"}`}>{contexto.length}/{MAX}</span>
          <button onClick={() => guardar()} disabled={guardando || !cargado || contexto === guardado} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Save className="h-4 w-4" />Guardar contexto</button>
        </div>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-brand-blue" : "text-red-600"}`}>{msg.t}</p>}
      </Panel>

      <Panel title="Paso 3: activa las respuestas con IA" subtitle={`Primero responde el modo Clásico. La IA solo contesta lo que no esté resuelto, usando únicamente tu contexto; si no sabe, avisa a una persona. Tope: ${limite} respuestas con IA al mes.`}>
        <label className="flex items-start gap-3 text-sm text-brand-dark">
          <input type="checkbox" className="mt-1" checked={iaActiva} disabled={!cargado || guardando || (contexto !== guardado)} onChange={(e) => guardar(e.target.checked)} />
          <span><b>Activar respuestas con IA</b>{contexto !== guardado && <span className="block text-xs text-amber-700">Guarda el contexto antes de activar.</span>}</span>
        </label>
        <div className="mt-3 rounded-xl bg-brand-blue/5 p-3 text-xs text-brand-dark/80">
          <b>Aviso de privacidad.</b> Al activarla, el texto de los mensajes que el modo Clásico no puede responder se envía a Anthropic (proveedor de la IA) solo para redactar la respuesta. No se guarda el texto de los clientes. Los mensajes con datos como RUT, tarjetas o correos, o sobre salud, reclamos y devoluciones, no se envían: los ve una persona. Recomendamos mencionarlo en tu política de privacidad.
        </div>
      </Panel>
    </div>
  );
}
