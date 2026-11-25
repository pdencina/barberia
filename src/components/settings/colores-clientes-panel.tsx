"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Panel, ghostButton } from "@/components/ui/premium";
import { ClientThemePreview } from "@/components/settings/client-theme-preview";
import { THEMES, type AppTheme, isAppTheme, normalizeTheme } from "@/lib/themes";

// Preferencias de reservas > "Colores para tus clientes": el negocio elige AHÍ MISMO el diseño que ven sus clientes
// (página de reservas, reseñas y correos), sin depender del tema que usa su equipo en el sistema.
// Opciones: «Los de siempre» (apagado), «El mismo de mi sistema» (migración 151) o uno de la lista (migración 177).
type Modo = "siempre" | "sistema" | AppTheme;

export function ColoresClientesPanel({ tenantId, slug, businessName }: { tenantId: string; slug: string; businessName: string }) {
  const { showToast } = useToast();
  const [temaSistema, setTemaSistema] = useState<AppTheme>(normalizeTheme("light"));
  const [modo, setModo] = useState<Modo>("siempre");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const sb = createClient();
    (async () => {
      let r: any = await sb.from("tenants").select("theme, client_theme_enabled, client_theme").eq("id", tenantId).maybeSingle();
      if (r.error) r = await sb.from("tenants").select("theme, client_theme_enabled").eq("id", tenantId).maybeSingle(); // sin la migración 177
      const d = r.data as any;
      if (!d) return;
      setTemaSistema(normalizeTheme(d.theme));
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

  const vista: AppTheme = modo === "siempre" ? normalizeTheme("light") : modo === "sistema" ? temaSistema : modo;
  const opciones: Array<{ key: Modo; titulo: string; detalle: string; fondo?: string; tinta?: string }> = [
    { key: "siempre", titulo: "Los de siempre", detalle: "Sin cambios" },
    { key: "sistema", titulo: "El mismo de mi sistema", detalle: THEMES.find((t) => t.value === temaSistema)?.label || "", fondo: THEMES.find((t) => t.value === temaSistema)?.background, tinta: THEMES.find((t) => t.value === temaSistema)?.ink },
    ...THEMES.map((t) => ({ key: t.value as Modo, titulo: t.label, detalle: "Diseño", fondo: t.background, tinta: t.ink })),
  ];

  return (
    <Panel title="Colores para tus clientes" subtitle="Elige el diseño que ven tus clientes en la página de reservas, las reseñas y los correos. No cambia lo que ve tu equipo.">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Diseño para tus clientes">
          {opciones.map((o) => {
            const sel = modo === o.key;
            return (
              <button key={o.key} type="button" role="radio" aria-checked={sel} disabled={guardando} onClick={() => elegir(o.key)}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition disabled:opacity-60 ${sel ? "border-brand-blue ring-2 ring-brand-blue/30" : "border-gray-200 hover:border-brand-blue/40"}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border" style={{ background: o.fondo || "#ffffff", borderColor: "rgba(0,0,0,.12)" }}>
                  {sel ? <Check className="h-4 w-4" style={{ color: o.tinta || "#202020" }} /> : <span className="h-3 w-3 rounded-full" style={{ background: o.tinta || "#9ca3af" }} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-brand-dark">{o.titulo}</span>
                  <span className="block truncate text-[11px] text-brand-gray">{o.detalle}</span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-brand-gray">Así se verían</p>
        <ClientThemePreview theme={vista} businessName={businessName} />

        <div className="flex flex-wrap items-center gap-2">
          {slug && (
            <a href={`/${slug}?vista_tema=${vista}`} target="_blank" rel="noopener noreferrer" className={ghostButton}>
              Ver mi página de reservas con estos colores <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <span className="text-[11px] text-brand-gray">{modo === "siempre" ? "Tus clientes ven los colores de siempre. El botón es solo una vista previa." : "Guardado: tus clientes ya ven este diseño."}</span>
        </div>
      </div>
    </Panel>
  );
}
