"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { PLAZOS_RAPIDOS, PLAZO_MAXIMO, fraseCorreoPlazo } from "@/lib/cambio-cliente";

// Correo de confirmación: hasta cuántas horas antes de la cita el cliente puede cancelar o modificar desde el correo.
// El mismo plazo se muestra en el correo y se aplica al cancelar desde el enlace.
export function PlazoCambiosCard() {
  const { showToast } = useToast();
  const [cargado, setCargado] = useState(false);
  const [faltaMigracion, setFaltaMigracion] = useState(false);
  const [guardado, setGuardado] = useState(2);
  const [opcion, setOpcion] = useState<string>("2");   // "1", "3"... o "otro"
  const [otro, setOtro] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch("/api/settings/plazo-cambios", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (typeof d?.hours !== "number") return;
      setGuardado(d.hours); setFaltaMigracion(!!d.migrationMissing);
      if (PLAZOS_RAPIDOS.includes(d.hours)) setOpcion(String(d.hours)); else { setOpcion("otro"); setOtro(String(d.hours)); }
      setCargado(true);
    }).catch(() => {});
  }, []);
  if (!cargado) return null;

  const horas = opcion === "otro" ? (otro.trim() === "" ? NaN : Number(otro)) : Number(opcion);
  const valido = Number.isInteger(horas) && horas >= 0 && horas <= PLAZO_MAXIMO;

  const guardar = async () => {
    if (!valido) { showToast(`Pon un número entero de horas entre 0 y ${PLAZO_MAXIMO}.`, "error"); return; }
    setGuardando(true);
    try {
      const res = await fetch("/api/settings/plazo-cambios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hours: horas }) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || "No se pudo guardar", "error"); return; }
      setGuardado(horas); showToast("Plazo guardado", "success");
    } catch { showToast("No se pudo guardar", "error"); } finally { setGuardando(false); }
  };

  return (
    <div className="bg-white dark:bg-brand-light/40 rounded-2xl border border-gray-100 dark:border-white/10 p-5 md:p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-brand-dark">Correo de confirmación: plazo para cancelar o modificar</h3>
        <p className="text-sm text-brand-gray mt-0.5">Hasta cuánto antes de la hora tu cliente puede cancelar o modificar su cita desde el correo. Se lo decimos en el correo y se respeta al cancelar.</p>
      </div>
      {faltaMigracion && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Falta aplicar la migración 144: por ahora rige siempre el plazo de 2 horas.</p>}
      <div className="flex flex-wrap gap-2">
        {PLAZOS_RAPIDOS.map((h) => (
          <button key={h} type="button" onClick={() => setOpcion(String(h))}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${opcion === String(h) ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 text-brand-dark hover:bg-gray-50"}`}>
            {h} {h === 1 ? "hora" : "horas"}
          </button>
        ))}
        <button type="button" onClick={() => { setOpcion("otro"); if (!otro) setOtro(String(guardado)); }}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${opcion === "otro" ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 text-brand-dark hover:bg-gray-50"}`}>
          Otro
        </button>
      </div>
      {opcion === "otro" && (
        <div className="flex items-center gap-2">
          <input type="number" min={0} max={PLAZO_MAXIMO} step={1} value={otro} onChange={(e) => setOtro(e.target.value)}
            className="w-28 rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="Ej: 4" />
          <span className="text-sm text-brand-gray">horas antes</span>
        </div>
      )}
      <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-brand-dark">
        {valido ? <>En el correo dirá: «{fraseCorreoPlazo(horas)}»</> : "Pon un número entero de horas."}
      </p>
      <div className="flex justify-end">
        <button type="button" onClick={guardar} disabled={guardando || !valido || horas === guardado}
          className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {guardando ? "Guardando..." : "Guardar plazo"}
        </button>
      </div>
    </div>
  );
}
