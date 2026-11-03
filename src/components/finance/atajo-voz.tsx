"use client";

import { useState } from "react";
import { Mic, Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";

// Hablar con Oti desde el iPhone con un botón del Centro de control: 3 pasos, sin llaves ni configuración técnica.
export function AtajoVoz() {
  const { showToast } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/dashboard?oti=hablar` : "https://www.re-booking.cl/dashboard?oti=hablar";
  const copiar = async () => { try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { showToast("No pude copiar; selecciónalo a mano", "error"); } };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
      <button type="button" onClick={() => setAbierto(!abierto)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-2"><Mic className="h-4 w-4 text-brand-blue" /><span className="font-bold text-brand-dark">Hablarle a Oti desde el iPhone</span></span>
        <span className="text-xs font-semibold text-brand-blue">{abierto ? "Ocultar" : "Ver cómo"}</span>
      </button>
      {abierto && (
        <div className="mt-4 space-y-3 text-sm text-brand-dark">
          <p className="text-xs text-brand-gray">Un botón en el Centro de control del iPhone que abre a Oti con el micrófono listo. Hablas, revisas lo escrito y envías.</p>
          <ol className="list-decimal space-y-3 pl-5 text-xs leading-relaxed">
            <li>
              Abre la app <b>Atajos</b> › toca <b>+</b> › busca la acción <b>Abrir URLs</b> y pega este enlace:
              <span className="mt-1 flex items-center gap-2"><code className="min-w-0 break-all rounded bg-gray-100 px-1.5 py-1">{url}</code>
                <button type="button" onClick={copiar} className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold">{copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copiado ? "Copiado" : "Copiar"}</button></span>
              Ponle de nombre <b>Oti</b> y guarda.
            </li>
            <li>Desliza para abrir el <b>Centro de control</b> › mantén presionado un espacio vacío › <b>Agregar un control</b> › <b>Atajos</b> › elige <b>Oti</b>.</li>
            <li>Toca el botón <b>Oti</b>, toca el micrófono si no empieza solo, y habla. Ejemplo: «compré pan, me salió mil quinientos».</li>
          </ol>
          <p className="text-[11px] text-brand-gray">La primera vez, el iPhone te pedirá permiso para usar el micrófono: acéptalo. Tienes que haber iniciado sesión en re-booking en Safari. Si el monto sale con letras y Oti no lo entiende, dilo con cifras («45 mil»).</p>
        </div>
      )}
    </div>
  );
}
