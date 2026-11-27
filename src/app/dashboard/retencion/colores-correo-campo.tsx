"use client";

import { PALETAS, coloresLegibles, type ColoresCorreo } from "@/lib/correo-colores";

// Colores del correo: paletas listas o a gusto. Si algo no se lee, se corrige solo y se avisa.
export function ColoresCorreoCampo({ colores, onChange }: { colores: ColoresCorreo; onChange: (c: ColoresCorreo) => void }) {
  const final = coloresLegibles(colores);
  const corregido = [final && final.texto !== colores.texto && "las letras", final && final.boton !== colores.boton && "el botón"].filter(Boolean).join(" y ");
  const igual = (c: ColoresCorreo) => c.fondo === colores.fondo && c.texto === colores.texto && c.boton === colores.boton;
  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 p-3.5">
      <div className="flex flex-wrap gap-1.5">
        {PALETAS.map((p) => (
          <button key={p.nombre} type="button" aria-pressed={igual(p.colores)} onClick={() => onChange(p.colores)} className={`inline-flex items-center gap-2 rounded-full border py-1.5 pl-2 pr-3 text-xs font-semibold text-brand-dark ${igual(p.colores) ? "border-brand-blue ring-2 ring-brand-blue/30" : "border-gray-200"}`}>
            <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border border-black/10" style={{ backgroundColor: p.colores.fondo }}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.colores.boton }} /></span>
            {p.nombre}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([["fondo", "Fondo"], ["texto", "Letras"], ["boton", "Botón"]] as const).map(([k, t]) => (
          <label key={k} className="text-xs font-semibold text-brand-gray">{t}
            <input type="color" value={colores[k]} onChange={(e) => onChange({ ...colores, [k]: e.target.value.toUpperCase() })} className="mt-1 block h-10 w-full cursor-pointer rounded-lg border border-gray-200 bg-transparent p-1" />
          </label>
        ))}
      </div>
      {corregido && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Con ese fondo no se leían {corregido}: en el correo usamos un color que sí se lee.</p>}
    </div>
  );
}
