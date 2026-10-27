"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { inputClass, primaryButton } from "@/components/ui/premium";

// Cuenta SII del profesional: solo la ve y la cambia el administrador del negocio (la API lo exige).
// bearer = quien paga el impuesto: "business" usa la cuenta del negocio; "professional" usa la de este profesional.
interface Acc {
  enabled: boolean; auto_emit: boolean; environment: "sandbox" | "production";
  emisor_rut: string; emisor_razon_social: string; emisor_giro: string; emisor_direccion: string; emisor_comuna: string;
  has_api_key: boolean;
}
const EMPTY: Acc = { enabled: false, auto_emit: false, environment: "sandbox", emisor_rut: "", emisor_razon_social: "", emisor_giro: "", emisor_direccion: "", emisor_comuna: "", has_api_key: false };

export function ProSiiAccount({ barberId }: { barberId: string }) {
  const { showToast } = useToast();
  const [bearer, setBearer] = useState<"business" | "professional">("business");
  const [acc, setAcc] = useState<Acc>(EMPTY);
  const [apiKey, setApiKey] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/barberos/${barberId}/sii`).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setProblem(j.error || "No se pudo cargar"); return; }
      setBearer(j.tax_bearer === "professional" ? "professional" : "business");
      if (j.config) setAcc({ ...EMPTY, ...Object.fromEntries(Object.entries(j.config).map(([k, v]) => [k, v ?? ""])) } as Acc);
      if (!j.encryption_ready) setProblem("Falta SECRET_BOX_KEY en el servidor: aún no se puede guardar la llave (la configura Pablo en Vercel).");
    });
  }, [barberId]);

  const set = (k: keyof Acc, v: any) => setAcc((a) => ({ ...a, [k]: v }));
  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/barberos/${barberId}/sii`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tax_bearer: bearer, ...(bearer === "professional" ? { ...acc, api_key: apiKey } : {}) }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { showToast(j.error || "No se pudo guardar", "error"); return; }
    if (apiKey) { set("has_api_key", true); setApiKey(""); }
    showToast("Cuenta SII guardada", "success");
  };
  const f = (k: keyof Acc, label: string) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input className={inputClass} value={String(acc[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
      <div>
        <h2 className="font-bold text-gray-800">Cuenta SII de este profesional</h2>
        <p className="text-xs text-gray-500 mt-1">Solo administradores. El profesional no puede verla ni cambiarla.</p>
      </div>
      {problem && <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{problem}</div>}
      <div className="space-y-2">
        {([
          ["business", "El negocio asume el impuesto", "Sus boletas salen con la cuenta del negocio. No se pide llave."],
          ["professional", "El profesional paga su propio impuesto", "Sus boletas salen con la cuenta SII del profesional (RUT y llave propios)."],
        ] as const).map(([v, t, d]) => (
          <label key={v} className={`flex items-start gap-3 rounded-xl border-2 p-3 text-sm cursor-pointer ${bearer === v ? "border-green-500 bg-green-50" : "border-gray-200"}`}>
            <input type="radio" name="tax_bearer" className="mt-1" checked={bearer === v} onChange={() => setBearer(v)} />
            <span><b className="block">{t}</b><span className="text-xs text-gray-500">{d}</span></span>
          </label>
        ))}
      </div>
      {bearer === "professional" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={acc.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Cuenta activa</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={acc.auto_emit} onChange={(e) => set("auto_emit", e.target.checked)} /> Emitir automáticamente al cobrar</label>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ambiente</label>
            <select className={inputClass} value={acc.environment} onChange={(e) => set("environment", e.target.value)}>
              <option value="sandbox">Pruebas (sin valor tributario)</option>
              <option value="production">Producción (boletas reales)</option>
            </select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {f("emisor_rut", "RUT del profesional")}{f("emisor_razon_social", "Nombre o razón social")}
            {f("emisor_giro", "Giro")}{f("emisor_comuna", "Comuna")}
            <div className="md:col-span-2">{f("emisor_direccion", "Dirección")}</div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Llave (API key) del profesional {acc.has_api_key && <b className="text-green-600">· ya cargada</b>}</label>
              <input type="password" autoComplete="off" className={inputClass} value={apiKey} placeholder={acc.has_api_key ? "Déjalo vacío para conservarla" : "Pégala aquí"} onChange={(e) => setApiKey(e.target.value)} />
              <p className="mt-1 text-xs text-gray-400">Se guarda cifrada y no se vuelve a mostrar. Si el profesional no tiene cuenta activa, sus ventas NO se emiten con la del negocio.</p>
            </div>
          </div>
        </div>
      )}
      <button className={primaryButton} disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar cuenta SII"}</button>
    </div>
  );
}
