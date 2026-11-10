"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Panel, ghostButton } from "@/components/ui/premium";
import { ClientThemePreview } from "@/components/settings/client-theme-preview";
import { THEMES, normalizeTheme } from "@/lib/themes";

// Preferencias de reservas > "Colores para tus clientes": que la página de reservas, las reseñas y los correos usen el tema del negocio.
// Muestra cómo se verían (dibujo) y deja abrir la página real con esos colores antes de activar (vista_tema solo cambia la vista).
export function ColoresClientesPanel({ tenantId, slug, businessName }: { tenantId: string; slug: string; businessName: string }) {
  const { showToast } = useToast();
  const [theme, setTheme] = useState(normalizeTheme("light"));
  const [activo, setActivo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    createClient().from("tenants").select("theme, client_theme_enabled").eq("id", tenantId).maybeSingle()
      .then(({ data, error }) => { if (!error && data) { setTheme(normalizeTheme((data as any).theme)); setActivo(!!(data as any).client_theme_enabled); } });
  }, [tenantId]);

  const cambiar = async (next: boolean) => {
    if (guardando) return;
    setActivo(next); setGuardando(true);
    try {
      const res = await fetch("/api/settings/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, clientThemeEnabled: next }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || ""); }
      showToast(next ? "Tus clientes verán los colores del sistema" : "Tus clientes verán los colores de siempre", "success");
    } catch (e: any) { setActivo(!next); showToast(e?.message || "No se pudo guardar", "error"); }
    setGuardando(false);
  };

  const nombreTema = THEMES.find((t) => t.value === theme)?.label || "";
  return (
    <Panel title="Colores para tus clientes" subtitle={`Que la página de reservas, las reseñas y los correos usen los colores de tu sistema (hoy: ${nombreTema})`}>
      <div className="space-y-4">
        <label className="flex cursor-pointer items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-bold text-brand-dark">Usar los colores del sistema con mis clientes</span>
            <span className="mt-1 block text-xs text-brand-gray">Aplica a la página de reservas, el carrusel y la página de reseñas, y a los correos de confirmación, cita modificada, recordatorio y gracias por tu visita. El tema se cambia en Configuración &gt; Tema del negocio.</span>
          </span>
          <button type="button" role="switch" aria-checked={activo} disabled={guardando} onClick={() => cambiar(!activo)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${activo ? "bg-brand-blue" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${activo ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </label>

        <p className="text-xs font-semibold uppercase tracking-wider text-brand-gray">Así se verían</p>
        <ClientThemePreview theme={theme} businessName={businessName} />

        <div className="flex flex-wrap items-center gap-2">
          {slug && (
            <a href={`/${slug}?vista_tema=${theme}`} target="_blank" rel="noopener noreferrer" className={ghostButton}>
              Ver mi página de reservas con estos colores <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <span className="text-[11px] text-brand-gray">{activo ? "Activado: tus clientes ya ven estos colores." : "Desactivado: tus clientes ven los colores de siempre. El botón es solo una vista previa."}</span>
        </div>
      </div>
    </Panel>
  );
}
