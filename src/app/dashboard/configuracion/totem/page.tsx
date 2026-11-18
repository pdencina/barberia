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
  const [pagoTerminal, setPagoTerminal] = useState(false);
  const [terminalListo, setTerminalListo] = useState(false);
  const [ventaAuto, setVentaAuto] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [web, setWeb] = useState("");
  const tq = tenant?.id ? `?tenantId=${tenant.id}` : "";

  useEffect(() => {
    fetch(`/api/settings/totem${tq}`).then((r) => r.json()).then((d) => {
      if (d.error) return;
      setEnabled(!!d.enabled); setCodigo(d.codigo || ""); setInfo(d.info || []); setFaltaMigracion(!!d.falta_migracion); setDesbloqueado(d.desbloqueado !== false || !!d.falta_migracion); setPagoQr(!!d.pagoQr); setMpListo(!!d.mpListo); setPagoTerminal(!!d.pagoTerminal); setTerminalListo(!!d.terminalListo); setVentaAuto(d.ventaAuto !== false); setWhatsapp(d.whatsapp || ""); setWeb(d.web || "");
    }).catch(() => {}).finally(() => setLoading(false));
  }, [tq]);

  const [revisando, setRevisando] = useState(false);
  const [revision, setRevision] = useState<any>(null);
  const revisar = async (aplicar: boolean) => {
    setRevisando(true);
    try {
      const res = await fetch("/api/totem/conciliar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: tenant?.id, dias: 30, aplicar }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) showToast(d.error || "No se pudo revisar", "error"); else { setRevision(d); if (aplicar) showToast("Propinas registradas", "success"); }
    } catch { showToast("Sin conexión", "error"); }
    setRevisando(false);
  };

  const guardar = async () => {
    setSaving(true);
    const res = await fetch("/api/settings/totem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: tenant?.id, enabled, info, pagoQr, pagoTerminal, ventaAuto, whatsapp, web }) });
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
              <span className="block font-bold text-brand-dark">Registrar la venta automáticamente</span>
              <span className="text-xs text-brand-gray">Cuando un cliente paga en el tótem (máquina o QR), la venta se crea sola como una venta normal: aparece en la billetera del profesional, el dashboard, el cierre y la caja (origen «Tótem»), suma puntos y emite la boleta si la tienes automática. Si la apagas, solo se avisa al equipo y la venta la registras tú en el POS.</span>
            </span>
            <input type="checkbox" className="mt-1 h-5 w-5 flex-shrink-0" checked={ventaAuto} onChange={(e) => setVentaAuto(e.target.checked)} />
          </label>

          <label className="flex items-start justify-between gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-brand-white p-4">
            <span>
              <span className="block font-bold text-brand-dark">Cobro con tarjeta en la máquina</span>
              <span className="text-xs text-brand-gray">Al tocar «Quiero pagar», el tótem manda el monto de la cita a la máquina de tarjetas del local (Mercado Pago Point o TUU) y el cliente paga ahí. Al aprobarse avisamos al profesional y a administración, y la venta se registra sola.</span>
              {!terminalListo && <span className="mt-1 block text-xs font-semibold text-amber-600">Primero conecta tu máquina en Configuración (Mercado Pago o TUU): hoy no hay una máquina lista.</span>}
            </span>
            <input type="checkbox" className="mt-1 h-5 w-5 flex-shrink-0" checked={pagoTerminal} onChange={(e) => setPagoTerminal(e.target.checked)} />
          </label>

          <label className="flex items-start justify-between gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-brand-white p-4">
            <span>
              <span className="block font-bold text-brand-dark">Pago por QR desde el celular</span>
              <span className="text-xs text-brand-gray">El cliente escribe su código y paga el saldo de su cita escaneando un QR (Mercado Pago). Cuando paga, avisamos al profesional y a administración, y la venta se registra sola.</span>
              {!mpListo && <span className="mt-1 block text-xs font-semibold text-amber-600">Primero conecta Mercado Pago en «Cobros online»: sin eso el QR no puede crearse.</span>}
            </span>
            <input type="checkbox" className="mt-1 h-5 w-5 flex-shrink-0" checked={pagoQr} onChange={(e) => setPagoQr(e.target.checked)} />
          </label>

          <div className="space-y-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-brand-white p-4">
            <p className="font-bold text-brand-dark">Cómo dejar un tótem funcionando</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-brand-gray">
              <li>En el equipo, abre Chrome en <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-blue">{url} <ExternalLink className="h-3 w-3" /></a></li>
              <li>Escribe el código de tu negocio (abajo). Queda guardado en ese equipo.</li>
              <li>En esa misma pantalla aparece el botón <strong>«Instalar como aplicación»</strong> (o usa el menú de Chrome ⋮ &gt; «Instalar app» / «Agregar a la pantalla de inicio»). Se instala con su propio ícono.</li>
              <li>Cierra Chrome y abre el tótem desde ese ícono: abre <strong>en pantalla completa, horizontal y sin la barra de Chrome</strong>, directo en el inicio, cada vez que lo enciendas.</li>
            </ol>
            <p className="text-xs text-brand-gray">El tótem está pensado para pantallas horizontales (1920×1080): todo se ajusta solo al tamaño de la pantalla. Si no lo instalas, igual pasa a pantalla completa al primer toque.</p>
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
              <p className="font-bold text-brand-dark">QR de WhatsApp y de tu página web</p>
              <p className="text-xs text-brand-gray">En el inicio del tótem aparece «Contáctanos», con un QR para escribirte por WhatsApp y otro para tu página web. Si dejas un campo vacío se usa el teléfono y el sitio web de tu negocio.</p>
            </div>
            <input className={campo} placeholder="WhatsApp (ej. +56 9 1234 5678)" maxLength={60} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            <input className={campo} placeholder="Página web (ej. www.mi-negocio.cl)" maxLength={120} value={web} onChange={(e) => setWeb(e.target.value)} />
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

          {/* Revisión de pagos con tarjeta: lo cobrado vs lo realmente pagado en Mercado Pago (la diferencia es la propina) */}
          <div className="space-y-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-brand-white p-4">
            <div>
              <p className="font-bold text-brand-dark">Revisar propinas de los pagos con tarjeta</p>
              <p className="text-xs text-brand-gray">Vuelve a leer en Mercado Pago cuánto se pagó de verdad en cada cobro hecho desde el tótem. Si el cliente agregó propina en la máquina, se registra a nombre del profesional (100% de él), igual que en el POS. Nunca cambia el valor de la venta.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={revisando} onClick={() => revisar(false)} className="rounded-xl border border-gray-200 dark:border-white/15 px-4 py-2 text-sm font-semibold text-brand-dark disabled:opacity-60">{revisando ? "Revisando…" : "Revisar (sin guardar)"}</button>
              {revision && revision.conPropina > 0 && !revision.aplicar && (
                <button type="button" disabled={revisando} onClick={() => revisar(true)} className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Registrar las {revision.conPropina} propinas encontradas</button>
              )}
            </div>
            {revision && (
              <div className="overflow-x-auto">
                <p className="mb-2 text-xs text-brand-gray">{revision.aplicar ? "Resultado guardado." : "Vista previa."} Últimos {revision.dias} días: {revision.total} pagos revisados, {revision.conPropina} con propina.</p>
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-brand-gray"><th className="py-1 pr-3">Fecha</th><th className="pr-3">Profesional</th><th className="pr-3">Cliente</th><th className="pr-3 text-right">Cobrado</th><th className="pr-3 text-right">Pagado</th><th className="pr-3 text-right">Propina</th><th>Estado</th></tr></thead>
                  <tbody>
                    {revision.filas.map((f: any) => (
                      <tr key={f.id} className="border-t border-gray-100 dark:border-white/10">
                        <td className="py-1 pr-3 whitespace-nowrap">{new Date(f.fecha).toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="pr-3">{f.profesional}</td><td className="pr-3">{f.cliente}</td>
                        <td className="pr-3 text-right">${Number(f.cobrado).toLocaleString("es-CL")}</td>
                        <td className="pr-3 text-right">{f.pagado != null ? `$${Number(f.pagado).toLocaleString("es-CL")}` : "-"}</td>
                        <td className="pr-3 text-right font-semibold">{f.propina ? `$${Number(f.propina).toLocaleString("es-CL")}` : "-"}</td>
                        <td>{({ con_propina: "Con propina", sin_propina: "Sin propina", propina_registrada: "Propina registrada", ya_tenia_propina: "Ya tenía propina", sin_maquina: "Sin máquina", no_se_pudo_leer: "No se pudo leer" } as Record<string, string>)[f.estado] || f.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
