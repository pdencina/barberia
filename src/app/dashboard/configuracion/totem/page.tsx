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
  const [codigo, setCodigo] = useState("");
  const [info, setInfo] = useState<Seccion[]>([]);
  const [faltaMigracion, setFaltaMigracion] = useState(false);
  const [desbloqueado, setDesbloqueado] = useState(true);
  const [pagoQr, setPagoQr] = useState(false);
  const [mpListo, setMpListo] = useState(false);
  const tq = tenant?.id ? `?tenantId=${tenant.id}` : "";

  useEffect(() => {
    fetch(`/api/settings/totem${tq}`).then((r) => r.json()).then((d) => {
      if (d.error) return;
      setEnabled(!!d.enabled); setCodigo(d.codigo || ""); setInfo(d.info || []); setFaltaMigracion(!!d.falta_migracion); setDesbloqueado(d.desbloqueado !== false || !!d.falta_migracion); setPagoQr(!!d.pagoQr); setMpListo(!!d.mpListo);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [tq]);

  const guardar = async () => {
    setSaving(true);
    const res = await fetch("/api/settings/totem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: tenant?.id, enabled, info, pagoQr }) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return showToast(d.error || "No se pudo guardar", "error");
    showToast("Tótem guardado", "success");
  };

  const url = typeof window !== "undefined" ? `${window.location.origin}/totems-autoatencion` : "";
  const campo = "w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-brand-white px-3 py-2 text-sm text-brand-dark";

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-3 md:p-6">
      <Link href="/dashboard/configuracion" className="inline-flex items-center gap-1 text-sm text-brand-gray hover:text-brand-dark"><ArrowLeft className="h-4 w-4" /> Configuración</Link>
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">Tótem de autoatención</h1>
        <p className="text-sm text-brand-gray">Una pantalla en el local para que el cliente avise su llegada con un código corto, se registre si no tiene hora, pida productos e infórmese.</p>
      </div>
      {faltaMigracion && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Falta aplicar la migración 162 en la base de datos.</p>}
      {!loading && !desbloqueado ? (
        <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-brand-white p-5">
          <p className="font-bold text-brand-dark">Servicio aparte</p>
          <p className="mt-1 text-sm text-brand-gray">El tótem de autoatención es un servicio adicional con costo mensual y todavía no está activado para tu negocio. Escríbenos para contratarlo y te lo habilitamos.</p>
        </div>
      ) : loading ? <p className="text-sm text-brand-gray">Cargando…</p> : (
        <>
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-brand-white p-4">
            <span><span className="block font-bold text-brand-dark">Activar el tótem</span><span className="text-xs text-brand-gray">Apagado: la dirección del tótem no abre.</span></span>
            <input type="checkbox" className="h-5 w-5" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          </label>

          <label className="flex items-start justify-between gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-brand-white p-4">
            <span>
              <span className="block font-bold text-brand-dark">Pago por QR desde el celular</span>
              <span className="text-xs text-brand-gray">El cliente escribe su código y paga el saldo de su cita escaneando un QR (Mercado Pago). Cuando paga, avisamos al profesional y a administración. La venta la registras tú en el POS como Mercado Pago.</span>
              {!mpListo && <span className="mt-1 block text-xs font-semibold text-amber-600">Primero conecta Mercado Pago en «Cobros online»: sin eso el QR no puede crearse.</span>}
            </span>
            <input type="checkbox" className="mt-1 h-5 w-5 flex-shrink-0" checked={pagoQr} onChange={(e) => setPagoQr(e.target.checked)} />
          </label>

          <div className="space-y-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-brand-white p-4">
            <p className="font-bold text-brand-dark">Cómo dejar un tótem funcionando</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-brand-gray">
              <li>En el equipo, abre Chrome en <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-blue">{url} <ExternalLink className="h-3 w-3" /></a></li>
              <li>Escribe el código de tu negocio (abajo). Queda guardado en ese equipo.</li>
              <li>Menú de Chrome (⋮) &gt; «Instalar app» o «Agregar a la pantalla de inicio»: así abre en pantalla completa y directo, cada vez que lo enciendas.</li>
            </ol>
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-4 text-center">
              <p className="text-xs text-brand-gray">Código del negocio</p>
              <p className="mt-1 text-3xl font-extrabold tracking-[0.3em] text-brand-dark">{codigo || "—"}</p>
            </div>
            <button type="button" onClick={async () => {
              if (!window.confirm("Se cambiará el código. Los tótems ya configurados dejarán de abrir hasta que escribas el nuevo. ¿Seguro?")) return;
              const res = await fetch("/api/settings/totem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: tenant?.id, enabled, info, nuevoCodigo: true }) });
              const d = await res.json().catch(() => ({}));
              if (res.ok && d.codigo) { setCodigo(d.codigo); showToast("Código nuevo generado", "success"); } else showToast(d.error || "No se pudo cambiar", "error");
            }} className="text-xs font-semibold text-brand-gray underline">Generar un código nuevo</button>
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
