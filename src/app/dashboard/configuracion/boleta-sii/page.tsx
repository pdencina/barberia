"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Panel, inputClass, primaryButton } from "@/components/ui/premium";

interface Cfg {
  enabled: boolean;
  auto_emit: boolean;
  environment: "sandbox" | "production";
  emisor_rut: string;
  emisor_razon_social: string;
  emisor_giro: string;
  emisor_direccion: string;
  emisor_comuna: string;
  has_api_key: boolean;
}

const EMPTY: Cfg = {
  enabled: false, auto_emit: false, environment: "sandbox", emisor_rut: "", emisor_razon_social: "",
  emisor_giro: "", emisor_direccion: "", emisor_comuna: "", has_api_key: false,
};

export default function BoletaSiiPage() {
  const { showToast } = useToast();
  const [cfg, setCfg] = useState<Cfg>(EMPTY);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sii-config")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) { setProblem(j.error || "No se pudo cargar"); return; }
        if (!j.encryption_ready) setProblem("Falta SECRET_BOX_KEY en el servidor: no se puede guardar la llave todavía (la configura Pablo en Vercel).");
        if (j.config) setCfg({ ...EMPTY, ...Object.fromEntries(Object.entries(j.config).map(([k, v]) => [k, v ?? ""])) } as Cfg);
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof Cfg, v: any) => setCfg((c) => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/sii-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cfg, api_key: apiKey }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { showToast(j.error || "No se pudo guardar", "error"); return; }
    if (apiKey) { set("has_api_key", true); setApiKey(""); }
    showToast("Boleta electrónica guardada", "success");
  };

  const field = (k: keyof Cfg, label: string, placeholder = "") => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input className={inputClass} value={String(cfg[k] ?? "")} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  const toggle = (k: "enabled" | "auto_emit", title: string, desc: string) => (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" className="mt-1" checked={cfg[k]} onChange={(e) => set(k, e.target.checked)} />
      <span><span className="block text-sm font-semibold text-brand-dark">{title}</span><span className="block text-xs text-brand-gray">{desc}</span></span>
    </label>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Link href="/dashboard/configuracion" className="inline-flex items-center gap-1 text-sm text-brand-gray"><ArrowLeft className="h-4 w-4" /> Configuración</Link>
      <h1 className="text-xl font-extrabold text-brand-dark">Boleta electrónica (SII)</h1>
      <p className="text-sm text-brand-gray">
        Conecta la cuenta de tu proveedor (OpenFactura / Haulmer). Con “Emitir automáticamente” encendido, cada venta cobrada genera su boleta
        y el comprobante que llega al correo del cliente incluye el número de boleta.
      </p>
      {problem && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{problem}</div>}
      {loading ? <p className="text-sm text-brand-gray">Cargando…</p> : (
        <>
          <Panel>
            <div className="space-y-4">
              {toggle("enabled", "Boleta electrónica activada", "Permite emitir boletas desde Boletas y el POS.")}
              {toggle("auto_emit", "Emitir automáticamente al cobrar", "Si falla el proveedor, la venta se cobra igual y puedes reintentar desde Boletas.")}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ambiente</label>
                <select className={inputClass} value={cfg.environment} onChange={(e) => set("environment", e.target.value)}>
                  <option value="sandbox">Pruebas (sin valor tributario)</option>
                  <option value="production">Producción (boletas reales)</option>
                </select>
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="grid gap-3 md:grid-cols-2">
              {field("emisor_rut", "RUT del emisor", "76.123.456-7")}
              {field("emisor_razon_social", "Razón social")}
              {field("emisor_giro", "Giro")}
              {field("emisor_comuna", "Comuna")}
              <div className="md:col-span-2">{field("emisor_direccion", "Dirección")}</div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Llave (API key) del proveedor {cfg.has_api_key && <b className="text-green-600">· ya cargada</b>}</label>
                <input type="password" autoComplete="off" className={inputClass} value={apiKey} placeholder={cfg.has_api_key ? "Déjalo vacío para conservarla" : "Pégala aquí"} onChange={(e) => setApiKey(e.target.value)} />
                <p className="mt-1 text-xs text-gray-400">Se guarda cifrada y no se vuelve a mostrar. La llave de pruebas y la de producción son distintas.</p>
              </div>
            </div>
          </Panel>
          <button className={primaryButton} disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar"}</button>
        </>
      )}
    </div>
  );
}
