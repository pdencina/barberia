"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { PageHeader, Panel, inputClass, primaryButton, ghostButton, tableStyles } from "@/components/ui/premium";
import { slugifyAd } from "@/lib/ad-tracking";
import AnalisisEmbudo, { type Analisis } from "@/components/vendedores/analisis";

type Stats = { iniciados: number; pagados: number; ingresos: number; conversion: number };
type Vendedor = { id: string; name: string; slug: string; token: string; active: boolean; stats: Stats };
const BASE = "https://www.re-booking.cl";
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

export default function VendedoresPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Vendedor[] | null>(null);
  const [migracion, setMigracion] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [filtro, setFiltro] = useState("");

  const load = () => fetch(`/api/superadmin/vendedores${filtro ? `?slug=${filtro}` : ""}`, { cache: "no-store" }).then((r) => r.json()).then((d) => { setRows(d.vendedores || []); setMigracion(d.migracion !== false); setAnalisis(d.analisis || null); }).catch(() => setRows([]));
  useEffect(() => { load(); }, [filtro]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = (t: string, m: string) => { navigator.clipboard.writeText(t); showToast(m, "success"); };
  const crear = async () => {
    setSaving(true);
    const r = await fetch("/api/superadmin/vendedores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug: slug || name }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { showToast(d.error || "No se pudo crear", "error"); return; }
    showToast("Vendedor creado", "success"); setName(""); setSlug(""); load();
  };
  const toggle = async (v: Vendedor) => {
    await fetch("/api/superadmin/vendedores", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: v.id, active: !v.active }) });
    load();
  };

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-5xl animate-fade-in">
      <PageHeader title="Vendedores" subtitle="Un link para cada vendedor, con sus propias métricas de venta" />
      {!migracion && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Falta aplicar la migración 156.</p>}

      <Panel title="Nuevo vendedor" subtitle="Escribe su nombre. Se crea su link y un enlace privado para que vea sus ventas.">
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <input value={name} onChange={(e) => { setName(e.target.value); if (!slug) { /* el link se arma solo */ } }} placeholder="Nombre (ej: Juan Pérez)" className={inputClass} />
          <input value={slug} onChange={(e) => setSlug(slugifyAd(e.target.value, 40))} placeholder={`Nombre del link (ej: ${slugifyAd(name, 40) || "juan"})`} className={inputClass} />
          <button type="button" onClick={crear} disabled={saving || !name.trim()} className={primaryButton}>Crear</button>
        </div>
      </Panel>

      <Panel title="Vendedores y sus ventas" subtitle="«Empezaron» son quienes llegaron por su link y comenzaron a contratar; «Pagaron», quienes completaron el primer pago." flush>
        {rows && rows.length === 0 ? <p className="px-5 pb-5 text-sm text-brand-gray">Todavía no hay vendedores.</p> : rows ? (
          <div className={tableStyles.wrap}>
            <table className={tableStyles.table}>
              <thead className={tableStyles.thead}>
                <tr><th className={tableStyles.th}>Vendedor</th><th className={tableStyles.thRight}>Empezaron</th><th className={tableStyles.thRight}>Pagaron</th><th className={tableStyles.thRight}>Primer cobro</th><th className={tableStyles.th}>Links</th><th className={tableStyles.thCenter}>Activo</th></tr>
              </thead>
              <tbody className={tableStyles.tbody}>
                {rows.map((v) => (
                  <tr key={v.id} className={tableStyles.tr}>
                    <td className={tableStyles.td}>{v.name}<span className="block text-[11px] text-brand-gray">/precios?v={v.slug}</span></td>
                    <td className={tableStyles.tdRight}>{v.stats.iniciados}</td>
                    <td className={tableStyles.tdRight}>{v.stats.pagados}</td>
                    <td className={tableStyles.tdRight}>{clp(v.stats.ingresos)}</td>
                    <td className={tableStyles.td}>
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" className={`${ghostButton} !px-2.5 !py-1.5 !text-xs`} onClick={() => copy(`${BASE}/precios?v=${v.slug}`, "Link de ventas copiado")}><Copy className="h-3.5 w-3.5" /> Link de ventas</button>
                        <button type="button" className={`${ghostButton} !px-2.5 !py-1.5 !text-xs`} onClick={() => copy(`${BASE}/vendedor/${v.token}`, "Enlace de métricas copiado")}><Copy className="h-3.5 w-3.5" /> Sus métricas</button>
                      </div>
                    </td>
                    <td className={tableStyles.tdCenter}><input type="checkbox" checked={v.active} onChange={() => toggle(v)} className="h-4 w-4" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-5 pb-5 text-sm text-brand-gray">Cargando...</p>}
      </Panel>

      <Panel title="Análisis de ventas" subtitle="Dónde se queda la gente, cuándo llega y con qué aparato. Elige un vendedor o mira todos (incluye a los creadores de contenido).">
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className={`${inputClass} mb-3 max-w-xs`}>
          <option value="">Todos</option>
          {(rows || []).map((v) => <option key={v.id} value={v.slug}>{v.name}</option>)}
        </select>
        <AnalisisEmbudo a={analisis} />
      </Panel>
    </div>
  );
}
