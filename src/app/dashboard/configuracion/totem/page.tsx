"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useTenant } from "@/lib/tenant-context";

interface Seccion { title: string; body: string }

export default function ConfiguracionTotemPage() {
  const { showToast } = useToast();
  const { tenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState("");
  const [info, setInfo] = useState<Seccion[]>([]);
  const [faltaMigracion, setFaltaMigracion] = useState(false);
  const tq = tenant?.id ? `?tenantId=${tenant.id}` : "";

  useEffect(() => {
    fetch(`/api/settings/totem${tq}`).then((r) => r.json()).then((d) => {
      if (d.error) return;
      setEnabled(!!d.enabled); setSlug(d.slug || ""); setInfo(d.info || []); setFaltaMigracion(!!d.falta_migracion);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [tq]);

  const guardar = async () => {
    setSaving(true);
    const res = await fetch("/api/settings/totem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: tenant?.id, enabled, info }) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return showToast(d.error || "No se pudo guardar", "error");
    showToast("Tótem guardado", "success");
  };

  const url = typeof window !== "undefined" && slug ? `${window.location.origin}/totem?negocio=${slug}` : "";
  const campo = "w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-brand-white px-3 py-2 text-sm text-brand-dark";

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-3 md:p-6">
      <Link href="/dashboard/configuracion" className="inline-flex items-center gap-1 text-sm text-brand-gray hover:text-brand-dark"><ArrowLeft className="h-4 w-4" /> Configuración</Link>
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">Tótem de autoatención</h1>
        <p className="text-sm text-brand-gray">Una pantalla en el local para que el cliente avise su llegada con un código corto, se registre si no tiene hora, pida productos e infórmese.</p>
      </div>
      {faltaMigracion && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Falta aplicar la migración 162 en la base de datos.</p>}
      {loading ? <p className="text-sm text-brand-gray">Cargando…</p> : (
        <>
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-brand-white p-4">
            <span><span className="block font-bold text-brand-dark">Activar el tótem</span><span className="text-xs text-brand-gray">Apagado: la dirección del tótem no abre.</span></span>
            <input type="checkbox" className="h-5 w-5" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          </label>

          <div className="space-y-2 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-brand-white p-4">
            <p className="font-bold text-brand-dark">Dirección del tótem</p>
            <p className="text-xs text-brand-gray">Ábrela en el equipo del local (pantalla completa). Guarda primero para que funcione.</p>
            {url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-sm font-semibold text-brand-blue">{url} <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" /></a> : <p className="text-sm text-brand-gray">Tu negocio aún no tiene dirección propia.</p>}
          </div>

          <div className="space-y-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-brand-white p-4">
            <div>
              <p className="font-bold text-brand-dark">Información para tus clientes</p>
              <p className="text-xs text-brand-gray">Cursos, promociones vigentes, planes y membresías. Cada bloque aparece como un botón en la pantalla «Información».</p>
            </div>
            {info.map((s, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-gray-100 dark:border-white/10 p-3">
                <div className="flex gap-2">
                  <input className={campo} placeholder="Título (ej. Promoción de noviembre)" maxLength={60} value={s.title} onChange={(e) => setInfo(info.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <button type="button" onClick={() => setInfo(info.filter((_, j) => j !== i))} className="rounded-xl border border-gray-200 dark:border-white/10 px-3 text-brand-gray hover:text-red-600" title="Quitar"><Trash2 className="h-4 w-4" /></button>
                </div>
                <textarea className={campo} rows={3} placeholder="Texto que verá el cliente" maxLength={600} value={s.body} onChange={(e) => setInfo(info.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
              </div>
            ))}
            {info.length < 8 && (
              <button type="button" onClick={() => setInfo([...info, { title: "", body: "" }])} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue"><Plus className="h-4 w-4" /> Agregar bloque</button>
            )}
          </div>

          <button type="button" onClick={guardar} disabled={saving} className="w-full rounded-xl bg-brand-blue py-3 font-bold text-white disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
        </>
      )}
    </div>
  );
}
