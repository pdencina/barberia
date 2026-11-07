"use client";
import { THEMES, type AppTheme } from "@/lib/themes";

export function ThemePicker({ value, onChange, disabled, inherit = false }: {
  value: AppTheme | null; onChange: (value: AppTheme | null) => void; disabled?: boolean; inherit?: boolean;
}) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="group" aria-label="Elegir tema">
    {THEMES.map(t => <button key={t.value} type="button" disabled={disabled} aria-pressed={value === t.value}
      onClick={() => onChange(t.value)}
      className={`rounded-xl border-2 p-3 text-xs font-semibold transition-colors disabled:opacity-50 ${value === t.value ? "border-brand-blue bg-brand-blue/5 text-brand-blue" : "border-gray-200 text-brand-gray"}`}>
      <span data-theme-swatch className="mb-2 flex h-9 items-center justify-center rounded-lg border text-base" style={{ backgroundColor: t.background, color: t.ink, borderColor: t.ink }}>Aa</span>
      {t.label}
    </button>)}
    {inherit && <button type="button" disabled={disabled} aria-pressed={value === null} onClick={() => onChange(null)}
      className={`rounded-xl border-2 p-3 text-xs font-semibold disabled:opacity-50 ${value === null ? "border-brand-blue bg-brand-blue/5 text-brand-blue" : "border-gray-200 text-brand-gray"}`}>Del negocio</button>}
  </div>;
}
