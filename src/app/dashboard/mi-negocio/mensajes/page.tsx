"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { useTenant } from "@/lib/tenant-context";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { primaryButton, ghostButton, inputClass } from "@/components/ui/premium";
import {
  DEFAULT_WHATSAPP_CONFIG, DEFAULT_CONFIRM_TEXT, WHATSAPP_VARIABLES, mergeWhatsAppConfig, renderWhatsAppMessage,
  type WhatsAppMessagesConfig,
} from "@/lib/whatsapp-confirm";
import { setWhatsAppConfigCache } from "@/lib/use-whatsapp-config";

type TextField = "confirm_text" | "deposit_text" | "transfer_text" | "welcome_text" | "info_text";

// Mi negocio > Mensajes de WhatsApp: el administrador cambia el texto del WhatsApp de confirmacion
// (Calendario y Mi Agenda) y activa, si quiere, abono, datos de transferencia, informacion del servicio y bienvenida.
// Todo lo extra viene apagado: sin tocar nada, los mensajes quedan como siempre.
export default function MensajesWhatsAppPage() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [cfg, setCfg] = useState<WhatsAppMessagesConfig>(DEFAULT_WHATSAPP_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const refs = useRef<Partial<Record<TextField, HTMLTextAreaElement | null>>>({});

  useEffect(() => {
    fetch("/api/settings/mensajes").then((r) => r.json()).then((d) => {
      setCfg(mergeWhatsAppConfig(d?.config)); setMissing(!!d?.migrationMissing); setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const set = <K extends keyof WhatsAppMessagesConfig>(k: K, v: WhatsAppMessagesConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  // Inserta {variable} donde esta el cursor del cuadro de texto.
  const insertVar = (field: TextField, key: string) => {
    const el = refs.current[field];
    const token = `{${key}}`;
    const cur = cfg[field];
    if (!el) { set(field, cur + token); return; }
    const a = el.selectionStart ?? cur.length, b = el.selectionEnd ?? cur.length;
    set(field, cur.slice(0, a) + token + cur.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + token.length, a + token.length); });
  };

  const sample = {
    clientName: "Matías Pérez", businessName: tenant?.name || "Tu negocio", professionalName: "Nicolás",
    serviceNames: ["Corte de cabello"], date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), time: "16:30", totalPrice: 18000,
  };
  const preview = renderWhatsAppMessage(sample, cfg, { welcome: cfg.welcome_enabled, info: cfg.info_enabled, deposit: cfg.deposit_enabled });

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/settings/mensajes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: cfg }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo guardar");
      const saved = mergeWhatsAppConfig(d.config); setCfg(saved); setWhatsAppConfigCache(saved);
      showToast("Mensajes guardados", "success");
    } catch (e: any) { showToast(e?.message || "No se pudo guardar", "error"); } finally { setSaving(false); }
  };

  const Vars = ({ field }: { field: TextField }) => (
    <div className="flex flex-wrap gap-1.5">
      {WHATSAPP_VARIABLES.map((v) => (
        <button key={v.key} type="button" onClick={() => insertVar(field, v.key)} title={v.label}
          className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-brand-gray hover:border-brand-blue/50 hover:text-brand-dark">
          {`{${v.key}}`}
        </button>
      ))}
    </div>
  );

  const Card = ({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) => (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-white md:p-5">
      <div>
        <h2 className="font-bold text-brand-dark">{title}</h2>
        {desc && <p className="text-xs text-brand-gray">{desc}</p>}
      </div>
      {children}
    </div>
  );

  if (!loaded) return <div className="flex justify-center p-10"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 animate-fade-in md:p-6">
      <div>
        <Link href="/dashboard/mi-negocio" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-brand-gray hover:text-brand-dark"><ChevronLeft className="h-3.5 w-3.5" /> Mi negocio</Link>
        <h1 className="text-xl font-bold text-brand-dark md:text-2xl">Mensajes de WhatsApp</h1>
        <p className="text-sm text-brand-gray">El texto que sale al tocar el botón de WhatsApp en el Calendario y en Mi Agenda. Las variables entre llaves se reemplazan solas con los datos de cada cita.</p>
      </div>
      {missing && <p className="rounded-xl bg-red-50 p-3 text-xs text-red-600">Falta aplicar la migración 113 en la base de datos: por ahora los mensajes quedan como siempre y no se puede guardar.</p>}

      <Card title="Mensaje de confirmación" desc="Va siempre. Puedes cambiar las palabras; las variables ponen el cliente, el negocio, el servicio, el profesional, el día, el mes y la hora.">
        <textarea ref={(el) => { refs.current.confirm_text = el; }} rows={5} maxLength={700} value={cfg.confirm_text}
          onChange={(e) => set("confirm_text", e.target.value)} className={`${inputClass} w-full resize-y`} />
        <Vars field="confirm_text" />
        <button type="button" onClick={() => set("confirm_text", DEFAULT_CONFIRM_TEXT)} className={ghostButton}>Volver al mensaje original</button>
      </Card>

      <Card title="Solicitar abono (opcional)" desc="Si lo activas, al enviar el WhatsApp aparece una casilla “Solicitar abono”. Nunca va marcada: tú decides en cada cita.">
        <label className="flex items-center gap-2 text-sm font-medium text-brand-dark">
          <input type="checkbox" checked={cfg.deposit_enabled} onChange={(e) => set("deposit_enabled", e.target.checked)} className="h-5 w-5" />
          Ofrecer “Solicitar abono” al enviar
        </label>
        {cfg.deposit_enabled && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-1.5"><input type="radio" checked={cfg.deposit_mode === "percent"} onChange={() => set("deposit_mode", "percent")} /> % del total</label>
              <label className="flex items-center gap-1.5"><input type="radio" checked={cfg.deposit_mode === "fixed"} onChange={() => set("deposit_mode", "fixed")} /> Monto fijo ($)</label>
              <input type="number" min={1} value={cfg.deposit_value} onChange={(e) => set("deposit_value", Number(e.target.value) || 0)} className={`${inputClass} w-28`} />
            </div>
            <label className="block text-xs font-medium text-brand-gray">Texto de la solicitud (usa {"{abono}"} para el monto)
              <textarea ref={(el) => { refs.current.deposit_text = el; }} rows={2} maxLength={500} value={cfg.deposit_text} onChange={(e) => set("deposit_text", e.target.value)} className={`${inputClass} mt-1 w-full resize-y`} />
            </label>
            <label className="block text-xs font-medium text-brand-gray">Datos de transferencia (banco, tipo y número de cuenta, RUT, correo…). Se agregan solo cuando pides abono.
              <textarea ref={(el) => { refs.current.transfer_text = el; }} rows={4} maxLength={500} value={cfg.transfer_text} onChange={(e) => set("transfer_text", e.target.value)}
                placeholder={"Banco Estado\nCuenta Vista 123456789\nRUT 12.345.678-9\nnombre@correo.cl"} className={`${inputClass} mt-1 w-full resize-y`} />
            </label>
          </div>
        )}
      </Card>

      <Card title="Información del servicio (opcional)" desc="Un texto extra, por ejemplo cuidados o qué traer. Si lo activas, aparece la casilla “Agregar información del servicio”.">
        <label className="flex items-center gap-2 text-sm font-medium text-brand-dark">
          <input type="checkbox" checked={cfg.info_enabled} onChange={(e) => set("info_enabled", e.target.checked)} className="h-5 w-5" />
          Ofrecer “Agregar información del servicio” al enviar
        </label>
        {cfg.info_enabled && (
          <>
            <textarea ref={(el) => { refs.current.info_text = el; }} rows={3} maxLength={700} value={cfg.info_text} onChange={(e) => set("info_text", e.target.value)} className={`${inputClass} w-full resize-y`} />
            <Vars field="info_text" />
          </>
        )}
      </Card>

      <Card title="Bienvenida (opcional)" desc="Un saludo de bienvenida al principio del mensaje, para clientes nuevos. Aparece como casilla “Agregar bienvenida”.">
        <label className="flex items-center gap-2 text-sm font-medium text-brand-dark">
          <input type="checkbox" checked={cfg.welcome_enabled} onChange={(e) => set("welcome_enabled", e.target.checked)} className="h-5 w-5" />
          Ofrecer “Agregar bienvenida” al enviar
        </label>
        {cfg.welcome_enabled && (
          <>
            <textarea ref={(el) => { refs.current.welcome_text = el; }} rows={3} maxLength={500} value={cfg.welcome_text} onChange={(e) => set("welcome_text", e.target.value)} className={`${inputClass} w-full resize-y`} />
            <Vars field="welcome_text" />
          </>
        )}
      </Card>

      <Card title="Así se vería" desc={cfg.deposit_enabled || cfg.info_enabled || cfg.welcome_enabled ? "Con todas las casillas marcadas, con datos de ejemplo." : "Con datos de ejemplo."}>
        <div className="flex items-start gap-2 rounded-2xl bg-[#E7FFDB] p-3 text-sm text-gray-800">
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#25D366]" />
          <p className="whitespace-pre-wrap">{preview}</p>
        </div>
      </Card>

      <div className="sticky bottom-3 flex justify-end">
        <button onClick={save} disabled={saving || missing} className={`${primaryButton} shadow-lg`}>{saving ? "Guardando…" : "Guardar mensajes"}</button>
      </div>
    </div>
  );
}
