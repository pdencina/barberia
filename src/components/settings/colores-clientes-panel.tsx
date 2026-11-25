"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Check, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Panel, ghostButton } from "@/components/ui/premium";
import { ClientThemePreview } from "@/components/settings/client-theme-preview";
import { THEMES, type AppTheme, isAppTheme, normalizeTheme } from "@/lib/themes";
import { ACENTOS, esHexAcento } from "@/lib/accent";

// Preferencias de reservas > "Colores para tus clientes": el negocio elige AHÍ MISMO el diseño que ven sus clientes
// (página de reservas, reseñas y correos), sin depender del tema que usa su equipo en el sistema.
// Opciones: «Los de siempre» (apagado), «El mismo de mi sistema» (migración 151) o uno de la lista (migración 177).
type Modo = "siempre" | "sistema" | AppTheme;

export function ColoresClientesPanel({ tenantId, slug, businessName }: { tenantId: string; slug: string; businessName: string }) {
  const { showToast } = useToast();
  const [temaSistema, setTemaSistema] = useState<AppTheme>(normalizeTheme("light"));
  const [modo, setModo] = useState<Modo>("siempre");
  const [guardando, setGuardando] = useState(false);
  const [acento, setAcento] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const sb = createClient();
    (async () => {
      let r: any = await sb.from("tenants").select("theme, client_theme_enabled, client_theme, client_accent").eq("id", tenantId).maybeSingle();
      if (r.error) r = await sb.from("tenants").select("theme, client_theme_enabled, client_theme").eq("id", tenantId).maybeSingle(); // sin la migración 178
      if (r.error) r = await sb.from("tenants").select("theme, client_theme_enabled").eq("id", tenantId).maybeSingle(); // sin la migración 177
      const d = r.data as any;
      if (!d) return;
      setTemaSistema(normalizeTheme(d.theme));
      setAcento(esHexAcento(d.client_accent) ? d.client_accent : null);
      setModo(!d.client_theme_enabled ? "siempre" : isAppTheme(d.client_theme) ? d.client_theme : "sistema");
    })();
  }, [tenantId]);

  const elegir = async (nuevo: Modo) => {
    if (guardando || nuevo === modo) return;
    const antes = modo;
    setModo(nuevo); setGuardando(true);
    try {
      const cuerpo = nuevo === "siempre" ? { tenantId, clientThemeEnabled: false } : nuevo === "sistema" ? { tenantId, clientTheme: null } : { tenantId, clientTheme: nuevo };
      let res = await fetch("/api/settings/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      // «Igual que el sistema» con la migración 177 pendiente: basta con encender la opción de siempre (151).
      if (!res.ok && nuevo === "sistema") res = await fetch("/api/settings/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, clientThemeEnabled: true }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || ""); }
      showToast(nuevo === "siempre" ? "Tus clientes verán los colores de siempre" : "Listo: tus clientes ya ven ese diseño", "success");
    } catch (e: any) { setModo(antes); showToast(e?.message || "No se pudo guardar", "error"); }
    setGuardando(false);
  };

  const elegirAcento = async (hex: string | null, forzar = false) => {
    if (guardando || (!forzar && hex === acento)) return;
    const antes = acento;
    setAcento(hex); setGuardando(true);
    try {
      const res = await fetch("/api/settings/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, clientAccent: hex }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || ""); }
      showToast(hex ? "Listo: tu página de reservas usa ese color" : "Tu página vuelve al color de siempre", "success");
    } catch (e: any) { setAcento(antes); showToast(e?.message || "No se pudo guardar", "error"); }
    setGuardando(false);
  };

  const vista: AppTheme = modo === "siempre" ? normalizeTheme("light") : modo === "sistema" ? temaSistema : modo;
  const [abierto, setAbierto] = useState<"diseno" | "color" | "vista" | null>(null);
  const alternar = (k: "diseno" | "color" | "vista") => setAbierto((x) => (x === k ? null : k));
  const opciones: Array<{ key: Modo; titulo: string; fondo?: string; tinta?: string }> = [
    { key: "siempre", titulo: "Los de siempre" },
    { key: "sistema", titulo: "El de mi sistema", fondo: THEMES.find((t) => t.value === temaSistema)?.background, tinta: THEMES.find((t) => t.value === temaSistema)?.ink },
    ...THEMES.map((t) => ({ key: t.value as Modo, titulo: t.label, fondo: t.background, tinta: t.ink })),
  ];
  const resumenDiseno = modo === "siempre" ? "Los de siempre" : modo === "sistema" ? "El de mi sistema" : THEMES.find((t) => t.value === modo)?.label || "";
  const acentoActual = ACENTOS.find((a) => a.hex.toLowerCase() === acento?.toLowerCase());
  const resumenColor = acento ? acentoActual?.label || "Personalizado" : "El de siempre";

  // Fila que se abre y se cierra con una flecha: deja la pantalla corta y ordenada.
  const fila = (id: "diseno" | "color" | "vista", titulo: string, resumen: string, punto: string | undefined, children: React.ReactNode) => (
    <div key={id} className="border-t border-gray-100 first:border-t-0">
      <button type="button" onClick={() => alternar(id)} aria-expanded={abierto === id} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
        <span className="text-sm font-semibold text-brand-dark">{titulo}</span>
        <span className="flex items-center gap-2 text-xs text-brand-gray">
          {punto && <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: punto }} />}
          {resumen}
          <ChevronDown className={`h-4 w-4 transition-transform ${abierto === id ? "rotate-180" : ""}`} />
        </span>
      </button>
      {abierto === id && <div className="pb-3">{children}</div>}
    </div>
  );

  return (
    <Panel title="Colores para tus clientes" subtitle="Cómo ven tu página de reservas, las reseñas y los correos. No cambia lo que ve tu equipo.">
      <div>
        {fila("diseno", "Diseño", resumenDiseno, undefined, <>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Diseño para tus clientes">
            {opciones.map((o) => {
              const sel = modo === o.key;
              return (
                <button key={o.key} type="button" role="radio" aria-checked={sel} disabled={guardando} onClick={() => elegir(o.key)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-60 ${sel ? "border-brand-blue bg-brand-blue/5 text-brand-dark" : "border-gray-200 text-brand-gray hover:border-brand-blue/40"}`}>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border" style={{ background: o.fondo || "#fff", borderColor: "rgba(0,0,0,.15)" }}>
                    {sel ? <Check className="h-2.5 w-2.5" style={{ color: o.tinta || "#202020" }} /> : o.tinta ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: o.tinta }} /> : null}
                  </span>
                  {o.titulo}
                </button>
              );
            })}
          </div>
        </>)}

        {fila("color", "Color principal", resumenColor, acento || undefined, <>
          <p className="mb-2 text-[11px] text-brand-gray">Botones, números, detalles y las formas que flotan de fondo.</p>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Color principal">
            <button type="button" role="radio" aria-checked={acento === null} disabled={guardando} onClick={() => elegirAcento(null)} title="El de siempre"
              className={`flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium disabled:opacity-60 ${acento === null ? "border-brand-blue ring-2 ring-brand-blue/30" : "border-gray-200 text-brand-gray"}`}>El de siempre</button>
            {ACENTOS.map((a) => {
              const sel = acento?.toLowerCase() === a.hex.toLowerCase();
              return (
                <button key={a.hex} type="button" role="radio" aria-checked={sel} aria-label={a.label} title={a.label} disabled={guardando} onClick={() => elegirAcento(a.hex)}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border border-black/10 transition disabled:opacity-60 ${sel ? "ring-2 ring-brand-blue/40 ring-offset-1" : ""}`} style={{ background: a.hex }}>
                  {sel && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              );
            })}
            <label className="flex h-7 cursor-pointer items-center gap-1 rounded-full border border-gray-200 px-2 text-[11px] font-medium text-brand-gray" title="Elegir otro color">
              Otro
              <input type="color" value={acento || "#0f8b8d"} disabled={guardando} onChange={(e) => setAcento(e.target.value)} onBlur={(e) => elegirAcento(e.target.value, true)} className="h-4 w-5 cursor-pointer rounded border-0 bg-transparent p-0" />
            </label>
          </div>
        </>)}

        {fila("vista", "Vista previa", "Así se vería", undefined, <>
          <ClientThemePreview theme={vista} businessName={businessName} accent={acento} />
          {slug && (
            <a href={`/${slug}?vista_tema=${vista}${acento ? `&vista_color=${acento.slice(1)}` : ""}`} target="_blank" rel="noopener noreferrer" className={`${ghostButton} mt-3`}>
              Ver mi página real <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </>)}
      </div>
    </Panel>
  );
}
