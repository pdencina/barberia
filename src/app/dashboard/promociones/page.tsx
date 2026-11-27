"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Plus } from "lucide-react";
import { useTenant } from "@/lib/tenant-context";
import { useToast } from "@/components/ui/toast";
import { useBorrador } from "@/lib/use-borrador";
import { SIN_CONDICIONES, errorCondiciones, type CondicionesPromo } from "@/lib/promo-condiciones";
import { codigosDePago } from "@/lib/cupon-pagos";
import { detallesPromo } from "@/lib/promo-link";
import { PromoCabecera } from "@/components/promo/promo-cabecera";
import { PromoCondicionesForm } from "../retencion/promo-condiciones-form";
import { PromoImagenCampo } from "../retencion/promo-imagen-campo";

interface Form { codigo: string; tipo: "percentage" | "fixed_amount"; valor: string; titulo: string; descripcion: string; imagen: string; maxUsos: string; activa: boolean; condiciones: CondicionesPromo }
const VACIA: Form = { codigo: "", tipo: "percentage", valor: "20", titulo: "", descripcion: "", imagen: "", maxUsos: "", activa: true, condiciones: SIN_CONDICIONES };
const ETIQUETAS: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", debit_card: "Débito", credit_card: "Crédito" };
const campo = "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-brand-dark outline-none focus:border-brand-blue";
const rotulo = "mb-1.5 block text-xs font-semibold text-brand-gray";

// Promociones: se crean y editan aquí (imagen, descuento, condiciones) y se revisa cómo se ve el link antes de compartirlo.
export default function PromocionesPage() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [cupones, setCupones] = useState<any[]>([]);
  const [pros, setPros] = useState<Array<{ id: string; name: string }>>([]);
  const [editando, setEditando] = useState<string>(""); // id del cupón; "" = promoción nueva
  const [form, setForm] = useState<Form>(VACIA);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(0);
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => { if (tenant?.slug) fetch(`/api/public/business-info?slug=${tenant.slug}`).then((r) => r.json()).then((d) => setLogo(d?.logo_url || null)).catch(() => {}); }, [tenant?.slug]);
  const t = tenant?.id;
  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  // La promoción nueva a medio armar queda como borrador en este equipo.
  const { borrar } = useBorrador<Form>(t && !editando ? `rb_borrador_promocion_${t}` : null, form, (g) => setForm({ ...VACIA, ...(g || {}), condiciones: { ...SIN_CONDICIONES, ...(g?.condiciones || {}) } }));

  const cargar = () => fetch(`/api/cupones${t ? `?tenantId=${t}` : ""}`).then((r) => r.json()).then((d) => setCupones(Array.isArray(d) ? d : [])).catch(() => {});
  useEffect(() => {
    if (!t) return;
    cargar();
    fetch(`/api/barberos?tenantId=${t}`).then((r) => r.json()).then((d) => setPros(Array.isArray(d) ? d.map((p: any) => ({ id: p.id, name: String(p.name || "").trim() })) : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const editar = (c: any) => {
    const r = c.conditions || {};
    setEditando(c.id);
    setForm({
      codigo: c.code, tipo: c.discount_type, valor: String(Number(c.discount_value) || ""), titulo: r.titulo || "", descripcion: c.description || "", imagen: r.imagen || "",
      maxUsos: c.max_uses ? String(c.max_uses) : "", activa: c.active !== false,
      condiciones: {
        ...SIN_CONDICIONES, desde: r.desde || "", hasta: r.hasta || "", horaDesde: r.horaDesde || "", horaHasta: r.horaHasta || "",
        pagos: (r.pagos || []).map((p: string) => ETIQUETAS[p]).filter(Boolean),
        profesionalIds: r.profesionalIds || [], profesionales: pros.filter((p) => (r.profesionalIds || []).includes(p.id)).map((p) => p.name),
      },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const nueva = () => { setEditando(""); setForm(VACIA); };

  const reglas = () => {
    const c = form.condiciones;
    return { desde: c.desde, hasta: c.hasta, horaDesde: c.horaDesde, horaHasta: c.horaHasta, profesionalIds: c.profesionalIds || [], pagos: c.todosLosPagos ? [] : codigosDePago(c.pagos), imagen: form.imagen, titulo: form.titulo };
  };

  const guardar = async () => {
    const codigo = form.codigo.trim().toUpperCase().replace(/\s+/g, "-");
    const valor = Number(form.valor);
    if (!codigo || !/^[A-Z0-9ÁÉÍÓÚÑ_-]{3,40}$/.test(codigo)) return showToast("Escribe un cupón de 3 a 40 letras o números, sin espacios", "error");
    if (!(valor > 0) || (form.tipo === "percentage" && valor > 100)) return showToast("Revisa el descuento", "error");
    const e = errorCondiciones(form.condiciones);
    if (e) return showToast(e, "error");
    setGuardando(true);
    try {
      // La promoción vence al terminar el último día (hora de Chile). Sin fecha «hasta», no vence sola.
      const vence = form.condiciones.hasta ? `${form.condiciones.hasta}T00:00:00Z` : null;
      let id = editando;
      if (!id) {
        const res = await fetch("/api/cupones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: t, code: codigo, description: form.descripcion, discountType: form.tipo, discountValue: valor, maxUses: Number(form.maxUsos) || null, validUntil: vence }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.id) return showToast(/duplicate|unique/i.test(d.error || "") ? `El cupón ${codigo} ya existe: usa otro nombre` : d.error || "No se pudo crear", "error");
        id = d.id;
      }
      const res = await fetch(`/api/cupones/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: form.descripcion, discount_type: form.tipo, discount_value: valor, max_uses: Number(form.maxUsos) || null, valid_until: vence, active: form.activa, conditions: reglas() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return showToast(d.error || "No se pudieron guardar las condiciones", "error");
      if (!editando) { borrar(); setEditando(id); setForm((f) => ({ ...f, codigo })); }
      showToast("Promoción guardada. El link ya muestra estos cambios.", "success");
      setGuardado((k) => k + 1);
      cargar();
    } finally { setGuardando(false); }
  };

  const actual = cupones.find((c) => c.id === editando);
  const link = actual && tenant?.slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/${tenant.slug}/promocion?cupon=${encodeURIComponent(actual.code)}` : "";
  const elegidos = pros.filter((p) => (form.condiciones.profesionalIds || []).includes(p.id)).map((p) => p.name);
  const detalles = detallesPromo({ ...reglas(), horaDesde: form.condiciones.horaDesde || undefined, horaHasta: form.condiciones.horaHasta || undefined }, elegidos.length ? elegidos : []);
  const titulo = form.titulo.trim() || (form.tipo === "percentage" && Number(form.valor) ? `${Number(form.valor)}% de descuento` : "Promoción");

  return (
    <div className="space-y-4 p-3 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-brand-dark md:text-2xl">Promociones</h1>
        <p className="text-sm text-brand-gray">Arma tu promoción, revisa cómo se ve y comparte el link.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={nueva} className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold ${!editando ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 bg-white text-brand-gray"}`}><Plus className="h-4 w-4" /> Nueva promoción</button>
        {cupones.map((c) => (
          <button key={c.id} type="button" onClick={() => editar(c)} className={`flex-shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${editando === c.id ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 bg-white text-brand-gray"}`}>
            {c.code}{c.active === false ? " · pausada" : ""}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className={rotulo}>Cupón (así se llama la promoción)</span>
              <input value={form.codigo} disabled={!!editando} onChange={(e) => set({ codigo: e.target.value.toUpperCase().replace(/\s+/g, "-").slice(0, 40) })} placeholder="BLACK-FRIDAY" className={`${campo} font-mono disabled:bg-gray-50`} /></label>
            <div><span className={rotulo}>Descuento</span>
              <div className="flex gap-2">
                <select value={form.tipo} onChange={(e) => set({ tipo: e.target.value as Form["tipo"] })} className={`${campo} w-28`}><option value="percentage">%</option><option value="fixed_amount">$</option></select>
                <input type="number" min="0" value={form.valor} onChange={(e) => set({ valor: e.target.value })} className={campo} />
              </div></div>
          </div>
          <PromoImagenCampo url={form.imagen} onChange={(imagen) => set({ imagen })} tenantId={t} showToast={showToast} />
          <label className="block"><span className={rotulo}>Título grande</span><input value={form.titulo} maxLength={80} onChange={(e) => set({ titulo: e.target.value })} placeholder="Ej: Promoción especial" className={campo} /></label>
          <label className="block"><span className={rotulo}>Texto bajo el título</span><textarea rows={3} maxLength={300} value={form.descripcion} onChange={(e) => set({ descripcion: e.target.value })} placeholder="Cuenta en una o dos líneas de qué se trata" className={campo} /></label>
          <PromoCondicionesForm value={form.condiciones} onChange={(condiciones) => set({ condiciones })} tenantId={t} hayCupon inputClass={campo} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className={rotulo}>Máximo de usos (vacío = sin límite)</span><input type="number" min="1" value={form.maxUsos} onChange={(e) => set({ maxUsos: e.target.value })} className={campo} /></label>
            {editando && <label className="flex items-end gap-2 pb-2.5 text-sm text-brand-dark"><input type="checkbox" checked={form.activa} onChange={(e) => set({ activa: e.target.checked })} /> Promoción activa</label>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={guardar} disabled={guardando} className="rounded-full bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear promoción"}</button>
            {link && (
              <>
                <button type="button" onClick={() => { navigator.clipboard?.writeText(link).then(() => showToast("Link copiado", "success")).catch(() => showToast(link, "info")); }} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-semibold text-brand-dark"><Copy className="h-4 w-4" /> Copiar link</button>
                <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-semibold text-brand-dark"><ExternalLink className="h-4 w-4" /> Abrir link</a>
              </>
            )}
          </div>
          {link && <p className="break-all text-xs text-brand-gray">{link}</p>}
          <p className="text-[11px] text-brand-gray">Nada cambia en el link hasta que tocas «{editando ? "Guardar cambios" : "Crear promoción"}».</p>
        </div>

        <div className="xl:sticky xl:top-4">
          <p className="mb-2 text-xs font-semibold text-brand-gray">Así se verá (cambia mientras escribes){guardado ? " · guardado" : ""}</p>
          <div className="mx-auto max-w-[390px] overflow-hidden rounded-[34px] border-[10px] border-[#111] bg-black">
            <div className="max-h-[720px] overflow-y-auto px-4 pb-8 pt-6 text-white" style={{ fontFamily: "Montserrat, -apple-system, Roboto, sans-serif", backgroundImage: "url('/correo/fondo-oscuro.png')", backgroundSize: "100% auto" }}>
              <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;700;800&display=swap" rel="stylesheet" />
              {logo && <img src={logo} alt="" className="mx-auto mb-4 h-12 w-auto max-w-[200px] object-contain" />}
              <PromoCabecera imagen={form.imagen || null} titulo={titulo} descripcion={form.descripcion || null} detalles={detalles} codigo={form.codigo} />
              <p className="mt-6 text-center text-[11px] font-light italic uppercase tracking-[0.32em] text-white/50">Abajo: servicio, día y hora</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
