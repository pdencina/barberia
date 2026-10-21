"use client";

import { useState } from "react";
import { useWhatsAppConfig } from "@/lib/use-whatsapp-config";
import {
  buildConfirmWhatsAppUrl, renderWhatsAppMessage, type ConfirmWhatsAppInput, type WhatsAppSendOptions,
} from "@/lib/whatsapp-confirm";

// Boton de WhatsApp del Calendario y de Mi Agenda. Si el negocio no activo nada extra (abono, bienvenida,
// informacion), es un link directo como siempre. Si activo alguno, al tocarlo se ofrecen casillas
// opcionales ANTES de abrir WhatsApp (ninguna viene marcada: nada es obligatorio).
export function WhatsAppSendButton({
  input, className, wrapperClassName, placement = "below", children,
}: {
  input: ConfirmWhatsAppInput;
  className: string;
  wrapperClassName?: string;
  placement?: "below" | "above";
  children: React.ReactNode;
}) {
  const cfg = useWhatsAppConfig();
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<WhatsAppSendOptions>({});

  const url = buildConfirmWhatsAppUrl(input, cfg, opts);
  if (!url) return null;

  const hasExtras = cfg.deposit_enabled || cfg.welcome_enabled || cfg.info_enabled;
  if (!hasExtras) {
    return <a href={buildConfirmWhatsAppUrl(input, cfg) as string} target="_blank" rel="noopener noreferrer" className={`${className} ${wrapperClassName || ""}`}>{children}</a>;
  }

  const rows: { key: keyof WhatsAppSendOptions; label: string; on: boolean }[] = [
    { key: "deposit", label: "Solicitar abono", on: cfg.deposit_enabled },
    { key: "info", label: "Agregar información del servicio", on: cfg.info_enabled },
    { key: "welcome", label: "Agregar bienvenida", on: cfg.welcome_enabled },
  ];

  return (
    <div className={`relative ${wrapperClassName || ""}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`${className} w-full`}>{children}</button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute left-0 z-50 w-72 max-w-[85vw] space-y-2 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-xl ${placement === "above" ? "bottom-full mb-2" : "top-full mt-2"}`}>
            <p className="text-xs font-semibold text-brand-dark">Mensaje de WhatsApp</p>
            {rows.filter((r) => r.on).map((r) => (
              <label key={r.key} className="flex items-center gap-2 text-sm text-brand-dark">
                <input type="checkbox" checked={!!opts[r.key]} onChange={(e) => setOpts({ ...opts, [r.key]: e.target.checked })} className="h-4 w-4" />
                {r.label}
              </label>
            ))}
            <p className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-[11px] leading-snug text-brand-gray">{renderWhatsAppMessage(input, cfg, opts)}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
              className="block rounded-lg bg-[#25D366] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#1da851]">
              Enviar por WhatsApp
            </a>
          </div>
        </>
      )}
    </div>
  );
}
