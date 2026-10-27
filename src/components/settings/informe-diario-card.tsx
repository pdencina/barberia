"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { todayInChile } from "@/lib/utils";
import {
  DIAS_SEMANA, aCuerpoPut, desdeRespuesta, formularioInicial, problemaFormulario,
  type FormularioInforme, type FrecuenciaInforme,
} from "@/lib/informe-diario-form";

const box = "rounded-2xl border border-gray-100 bg-white p-4 md:p-5 space-y-4";
const input = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-blue focus:outline-none";
const FRECUENCIAS: Array<{ v: FrecuenciaInforme; l: string }> = [
  { v: "daily", l: "Todos los días" },
  { v: "every_3_days", l: "Cada 3 días" },
  { v: "weekly", l: "Una vez por semana" },
  { v: "custom", l: "Días que elijo" },
];

// Mi Perfil > Informes: cada administrador decide si recibe por correo el resumen de las citas del dia, y cada cuanto.
// Habla solo con /api/agente/informe-preferencias (sesion y negocio los valida el servidor). Viene apagado.
export function InformeDiarioCard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [estado, setEstado] = useState<"cargando" | "listo" | "no_disponible">("cargando");
  const [form, setForm] = useState<FormularioInforme>(formularioInicial());
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/agente/informe-preferencias", { cache: "no-store" })
      .then(async (r) => {
        if (!vivo) return;
        if (!r.ok) { setEstado("no_disponible"); return; }
        const d = await r.json().catch(() => null);
        setForm(desdeRespuesta(d?.preference));
        setEstado("listo");
      })
      .catch(() => vivo && setEstado("no_disponible"));
    return () => { vivo = false; };
  }, []);

  const set = (cambios: Partial<FormularioInforme>) => { setAviso(null); setForm((f) => ({ ...f, ...cambios })); };
  const alternarDia = (d: number) => set({ custom_weekdays: form.custom_weekdays.includes(d) ? form.custom_weekdays.filter((x) => x !== d) : [...form.custom_weekdays, d] });

  const guardar = async () => {
    const problema = problemaFormulario(form);
    if (problema) { setAviso(problema); return; }
    setGuardando(true);
    try {
      const r = await fetch("/api/agente/informe-preferencias", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(aCuerpoPut(form, todayInChile())),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setAviso(d?.error || "No se pudo guardar. Intenta de nuevo."); return; }
      setForm(desdeRespuesta(d.preference));
      showToast(form.enabled ? "Informe activado" : "Informe desactivado", "success");
    } catch {
      setAviso("No se pudo guardar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  if (estado === "cargando") return <div className="flex justify-center py-8"><Spinner /></div>;
  if (estado === "no_disponible") {
    return (
      <div className={box}>
        <h2 className="font-bold text-brand-dark">Informe de citas por correo</h2>
        <p className="text-sm text-brand-gray">Esta función todavía no está disponible para tu cuenta.</p>
      </div>
    );
  }

  return (
    <div className={box}>
      <div>
        <h2 className="font-bold text-brand-dark">Informe de citas por correo</h2>
        <p className="text-xs text-brand-gray">
          Recibe un resumen de las citas del día: por profesional, cuántas se completaron, cuáles se cancelaron y quién no llegó.
          Llega a tu correo{user?.email ? <> <span className="font-semibold text-brand-dark">{user.email}</span></> : ""}; no se puede enviar a otro.
        </p>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl bg-brand-light px-3 py-3">
        <span className="text-sm font-semibold text-brand-dark">Quiero recibir el informe</span>
        <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="h-5 w-5 accent-brand-blue" />
      </label>

      {form.enabled && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-gray">¿Cada cuánto?</label>
            <select className={input} value={form.frequency} onChange={(e) => set({ frequency: e.target.value as FrecuenciaInforme })}>
              {FRECUENCIAS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
            </select>
          </div>

          {form.frequency === "weekly" && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-brand-gray">¿Qué día de la semana?</label>
              <select className={input} value={form.weekly_weekday ?? ""} onChange={(e) => set({ weekly_weekday: e.target.value === "" ? null : Number(e.target.value) })}>
                <option value="">Elige un día</option>
                {DIAS_SEMANA.map((n, i) => <option key={n} value={i}>{n}</option>)}
              </select>
            </div>
          )}

          {form.frequency === "custom" && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-brand-gray">¿Qué días?</label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((n, i) => (
                  <button key={n} type="button" onClick={() => alternarDia(i)} aria-pressed={form.custom_weekdays.includes(i)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${form.custom_weekdays.includes(i) ? "bg-brand-blue text-white" : "border border-gray-200 bg-white text-brand-gray hover:border-brand-blue/40"}`}>
                    {n.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-gray">¿A qué hora? (hora de Chile)</label>
            <input type="time" className={input} value={form.send_local_time ?? ""} onChange={(e) => set({ send_local_time: e.target.value || null })} />
            <p className="mt-1 text-[11px] text-brand-gray">A las 21:00 la jornada ya terminó y el informe muestra las citas de ese mismo día. Las citas que cambien después no aparecen.</p>
          </div>
        </div>
      )}

      {aviso && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{aviso}</p>}

      <button type="button" onClick={guardar} disabled={guardando}
        className="w-full rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-blue/25 transition-all hover:opacity-90 disabled:opacity-50">
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
