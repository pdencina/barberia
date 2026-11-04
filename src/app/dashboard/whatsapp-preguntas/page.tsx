"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Sparkles } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/premium";

interface Pregunta { id: string; titulo: string; claves: string[]; respuesta: string; activo: boolean }
const PENDIENTE = "Escribe aquí la respuesta.";
// Sugeridas: título y palabras que activan la respuesta. Quedan apagadas hasta que escribas la respuesta.
const SUGERIDAS: { titulo: string; claves: string; respuesta: string }[] = [
  { titulo: "Atrasos", claves: "llego tarde, atraso, atrasado, tolerancia", respuesta: "Te esperamos hasta [X] minutos pasada tu hora. Si vas a llegar más tarde, avísanos por aquí para ver cómo ayudarte." },
  { titulo: "Cambiar o cancelar una hora", claves: "cambiar mi hora, cambiar la hora, cancelar, reagendar, anticipacion", respuesta: "Puedes cambiar o cancelar tu hora avisando con al menos [X horas] de anticipación, desde el correo de confirmación o escribiéndonos por aquí." },
  { titulo: "Orden de llegada o con cita", claves: "orden de llegada, sin cita, sin hora", respuesta: "Atendemos [con hora agendada / por orden de llegada según disponibilidad]. Para asegurar tu hora, agenda aquí: [link de reserva]." },
  { titulo: "Medios de pago", claves: "medios de pago, mercado pago, transferencia, tarjeta, efectivo, cuotas", respuesta: "Aceptamos [efectivo, tarjetas, transferencia y Mercado Pago]." },
  { titulo: "Estacionamiento", claves: "estacionamiento, estacionar, donde dejo el auto", respuesta: "[Sí / No] contamos con estacionamiento. [Detalle: dónde, si es pagado o gratuito]." },
  { titulo: "Cómo llegar", claves: "metro, micro, locomocion, como llego", respuesta: "Estamos en [dirección]. Metro más cercano: [estación]. Micros que te dejan cerca: [recorridos]." },
  { titulo: "Primera visita", claves: "primera visita, primera vez, descuento", respuesta: "En tu primera visita tienes [cortesía o beneficio]. [Detalle de cómo canjearlo]." },
  { titulo: "Reseña en Google", claves: "resena, reseña, google", respuesta: "Si nos dejas una reseña en Google, te regalamos [beneficio]. Muéstrala en el local y listo." },
  { titulo: "Cortesías (café)", claves: "cafe, cortesia", respuesta: "Sí, ofrecemos [café / bebida] de cortesía durante tu atención." },
  { titulo: "No me llegó el correo", claves: "correo de confirmacion, no me llego el correo, confirmacion", respuesta: "Revisa tu carpeta de spam o promociones. Si no lo encuentras, una persona del equipo te confirma tu hora por aquí." },
  { titulo: "Agendar manualmente", claves: "agendar manualmente, no entiendo la pagina, ayuda para agendar", respuesta: "Claro, te ayudo. Dime con qué profesional y a qué hora te acomoda y lo agendamos por aquí." },
  { titulo: "Agendar para dos personas", claves: "dos personas, para dos, amigo, hijo", respuesta: "Sí, se puede. Dime con qué profesionales y a qué hora y te ayudo a agendar a las dos personas." },
  { titulo: "Productos que venden", claves: "cera, polvo texturizador, productos, venden", respuesta: "Vendemos [marcas y productos]. Consulta precios y stock en el local." },
  { titulo: "Cortes para mujeres o niños", claves: "mujeres, ninos, niños, menores", respuesta: "Atendemos [mujeres / niños desde X años]. Puedes ver el servicio y agendar aquí: [link de reserva]." },
  { titulo: "Curso: cuándo empieza", claves: "curso, empieza el curso, inicio del curso", respuesta: "El próximo curso inicia el [fecha]. Son [N] clases, [días y horario]." },
  { titulo: "Curso: precio y abono", claves: "valor del curso, precio del curso, abono, cupo", respuesta: "El curso cuesta [valor total] y el cupo se reserva con un abono de [monto]." },
  { titulo: "Curso: herramientas y certificado", claves: "herramientas, kit, certificado", respuesta: "El curso [incluye / no incluye] herramientas. Al terminar se entrega [certificado]." },
  { titulo: "Curso: devoluciones", claves: "devuelven, reembolso, devolucion", respuesta: "[Escribe aquí la política de devolución del abono.]" },
];
// Una respuesta con [corchetes] todavía tiene datos por completar: no se puede activar.
const tieneHuecos = (r: string) => r.trim() === PENDIENTE || /\[[^\]]+\]/.test(r);
const vacio = { titulo: "", claves: "", respuesta: "" };

export default function PreguntasPage() {
  const [lista, setLista] = useState<Pregunta[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ id?: string; titulo: string; claves: string; respuesta: string }>(vacio);
  const [guardando, setGuardando] = useState(false);
  const [cargandoSug, setCargandoSug] = useState(false);

  const cargar = async () => {
    const r = await fetch("/api/agente/preguntas", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error || "No se pudo cargar"); return; }
    setError(""); setLista(j.preguntas);
  };
  useEffect(() => { cargar(); }, []);

  const enviar = async (metodo: "POST" | "PATCH", cuerpo: object) => {
    const r = await fetch("/api/agente/preguntas", { method: metodo, headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "No se pudo guardar");
  };
  const guardar = async () => {
    setGuardando(true); setError("");
    try {
      await enviar(form.id ? "PATCH" : "POST", { id: form.id, titulo: form.titulo, claves: form.claves, respuesta: form.respuesta });
      setForm(vacio); await cargar();
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  };
  const cambiarActivo = async (p: Pregunta) => {
    try { await enviar("PATCH", { ...p, activo: !p.activo }); await cargar(); } catch (e: any) { setError(e.message); }
  };
  const borrar = async (p: Pregunta) => {
    if (!window.confirm(`¿Borrar «${p.titulo}»?`)) return;
    await fetch(`/api/agente/preguntas?id=${p.id}`, { method: "DELETE" }); await cargar();
  };
  const cargarSugeridas = async () => {
    if (cargandoSug) return;
    setCargandoSug(true); setError("");
    try {
      // Se vuelve a leer la lista para no repetir temas: los que ya existen solo reciben el texto sugerido si siguen sin respuesta.
      const r = await fetch("/api/agente/preguntas", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "No se pudo cargar");
      const actuales: Pregunta[] = j.preguntas ?? [];
      for (const sug of SUGERIDAS) {
        const ya = actuales.find((p) => p.titulo === sug.titulo);
        if (!ya) await enviar("POST", { titulo: sug.titulo, claves: sug.claves, respuesta: sug.respuesta, activo: false });
        else if (ya.respuesta.trim() === PENDIENTE) await enviar("PATCH", { id: ya.id, titulo: ya.titulo, claves: ya.claves, respuesta: sug.respuesta, activo: false });
      }
      await cargar();
    } catch (e: any) { setError(e.message); } finally { setCargandoSug(false); }
  };

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-4xl animate-fade-in">
      <PageHeader title="Preguntas del agente" subtitle="Escribe una vez lo que tus clientes preguntan siempre; el agente de WhatsApp lo responde solo" />
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <Panel title={form.id ? "Editar pregunta" : "Nueva pregunta"} subtitle="Las palabras clave son las que, si el cliente las escribe, activan esta respuesta (sepáralas con coma)">
        <div className="space-y-3">
          <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título (solo para ti). Ej: Medios de pago" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent" maxLength={120} />
          <input value={form.claves} onChange={(e) => setForm({ ...form, claves: e.target.value })} placeholder="Palabras clave. Ej: transferencia, mercado pago, tarjeta" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent" />
          <textarea value={form.respuesta} onChange={(e) => setForm({ ...form, respuesta: e.target.value })} placeholder="Respuesta que verá el cliente" rows={4} maxLength={700} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-brand-gray">{form.respuesta.length}/700</span>
            <div className="flex gap-2">
              {form.id && <button onClick={() => setForm(vacio)} className="rounded-xl border px-3 py-2 text-sm">Cancelar</button>}
              <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{form.id ? "Guardar cambios" : "Agregar"}</button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title={`Tus preguntas${lista ? ` (${lista.length})` : ""}`} action={<button onClick={cargarSugeridas} disabled={cargandoSug} className="inline-flex disabled:opacity-50 items-center gap-1.5 rounded-xl border border-brand-blue/30 px-3 py-1.5 text-xs font-semibold text-brand-blue"><Sparkles className="h-3.5 w-3.5" />{cargandoSug ? "Cargando…" : "Cargar sugeridas"}</button>}>
        {!lista && !error && <p className="text-sm text-brand-gray">Cargando…</p>}
        {lista && lista.length === 0 && <p className="text-sm text-brand-gray">Aún no hay preguntas. Usa «Cargar sugeridas»: trae 18 respuestas ya escritas. Completa lo que está entre [corchetes] y actívalas.</p>}
        <div className="divide-y divide-gray-100 dark:divide-white/10">
          {lista?.map((p) => {
            const sinResponder = tieneHuecos(p.respuesta);
            return (
              <div key={p.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-brand-dark">{p.titulo} {sinResponder && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Completa los [corchetes]</span>}</p>
                  <p className="mt-0.5 text-xs text-brand-gray">Palabras: {p.claves.join(", ")}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-brand-dark/80">{p.respuesta}</p>
                </div>
                <label className="flex items-center gap-1 text-xs text-brand-gray"><input type="checkbox" checked={p.activo} disabled={sinResponder} onChange={() => cambiarActivo(p)} />Activa</label>
                <button onClick={() => { setForm({ id: p.id, titulo: p.titulo, claves: p.claves.join(", "), respuesta: p.respuesta.trim() === PENDIENTE ? "" : p.respuesta }); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Editar" className="rounded-lg p-2 text-brand-gray hover:bg-brand-blue/10 hover:text-brand-blue"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => borrar(p)} aria-label="Borrar" className="rounded-lg p-2 text-brand-gray hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
