"use client";
import { MAIL_PALETTES } from "@/lib/mail-theme";
import { type AppTheme, THEMES } from "@/lib/themes";

// Vista previa (solo dibujo) de cómo se ven la página de reservas y el correo de confirmación con el tema elegido.
export function ClientThemePreview({ theme, businessName }: { theme: AppTheme; businessName: string }) {
  const p = MAIL_PALETTES[theme];
  const label = THEMES.find((t) => t.value === theme)?.label || "";
  const nombre = businessName || "Tu negocio";
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-label={`Vista previa con el tema ${label}`}>
      {/* Página de reservas */}
      <div className="rounded-xl border p-3" style={{ background: p.page, borderColor: p.border }}>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: p.muted }}>Página de reservas</p>
        <div className="rounded-lg border p-3" style={{ background: p.card, borderColor: p.border }}>
          <p className="text-sm font-bold" style={{ color: p.text }}>{nombre}</p>
          <p className="text-[11px]" style={{ color: p.muted }}>Elige tu servicio</p>
          <div className="mt-2 space-y-1.5">
            {["Corte de pelo", "Corte + barba"].map((s, i) => (
              <div key={s} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-[11px]" style={{ borderColor: i === 0 ? p.accent : p.border, background: i === 0 ? p.soft : p.card, color: p.text }}>
                <span>{s}</span><span style={{ color: p.accent, fontWeight: 700 }}>{i === 0 ? "$12.000" : "$16.000"}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-md py-1.5 text-center text-[11px] font-bold" style={{ background: p.accent, color: p.onAccent }}>Continuar</div>
        </div>
      </div>
      {/* Correo de confirmación */}
      <div className="rounded-xl border p-3" style={{ background: p.page, borderColor: p.border }}>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: p.muted }}>Correo de confirmación</p>
        <div className="overflow-hidden rounded-lg border" style={{ background: p.card, borderColor: p.border }}>
          <div style={{ height: 4, background: p.accent }} />
          <div className="p-3">
            <p className="text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: p.accent }}>Cita confirmada</p>
            <p className="mt-2 text-[11px]" style={{ color: p.text2 }}>Hola <b style={{ color: p.text }}>María</b>, tu cita está confirmada</p>
            {[["Servicio", "Corte de pelo"], ["Fecha", "martes 12 de noviembre"], ["Hora", "15:30"]].map(([k, v]) => (
              <div key={k} className="mt-1 flex justify-between border-t pt-1 text-[11px]" style={{ borderColor: p.line }}>
                <span style={{ color: p.muted }}>{k}</span><b style={{ color: p.text }}>{v}</b>
              </div>
            ))}
            <div className="mt-2 rounded-md py-1.5 text-center text-[11px] font-bold" style={{ background: p.accent, color: p.onAccent }}>Cancelar o modificar cita</div>
          </div>
        </div>
      </div>
    </div>
  );
}
