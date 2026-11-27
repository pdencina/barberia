"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Monitor, Smartphone, X } from "lucide-react";

type Equipo = "celular" | "computador";
const ANCHO = { celular: 390, computador: 900 } as const; // ancho real que "ve" el correo
const ALTO = { celular: 760, computador: 720 } as const;

// Muestra el correo como se ve en la bandeja de un celular o de un computador: el contenido se dibuja con su ancho real
// y se achica para caber en el espacio disponible.
function Marco({ equipo, asunto, html, maxAlto }: { equipo: Equipo; asunto: string; html: string; maxAlto?: number }) {
  const caja = useRef<HTMLDivElement>(null);
  const [disponible, setDisponible] = useState(0);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setDisponible(el.clientWidth);
    medir();
    const o = new ResizeObserver(medir);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const celular = equipo === "celular";
  const ancho = ANCHO[equipo];
  const alto = ALTO[equipo];
  const borde = celular ? 20 : 2; // grosor del marco (ambos lados)
  const escala = disponible ? Math.min(1, (disponible - borde) / ancho, maxAlto ? maxAlto / (alto + 110) : 1) : 0;

  return (
    <div ref={caja} className="w-full">
      {escala > 0 && (
        <div className={`mx-auto overflow-hidden shadow-xl ${celular ? "rounded-[38px] border-[10px] border-[#111]" : "rounded-xl border border-gray-300"}`}
          style={{ width: ancho * escala + borde, background: "#FFFFFF", color: "#202124" }}>
          {celular ? (
            <div className="flex justify-center py-1.5"><span className="h-4 w-20 rounded-full bg-[#111]" /></div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: "#F1F3F4" }}>
              {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />)}
              <span className="ml-2 text-[10px]" style={{ color: "#5F6368" }}>Bandeja de entrada</span>
            </div>
          )}
          <div className="px-3 py-2.5" style={{ borderBottom: "1px solid #EEEEEE" }}>
            <p className="text-[13px] font-semibold leading-snug" style={{ color: "#202124" }}>{asunto}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#111] text-[11px] font-bold text-white">r</span>
              <span className="min-w-0 text-[11px] leading-tight" style={{ color: "#5F6368" }}><b className="block" style={{ color: "#202124" }}>re-booking</b>para ti · ahora</span>
            </div>
          </div>
          <div style={{ width: ancho * escala, height: alto * escala }} className="overflow-hidden">
            <iframe title="" aria-label={`Vista previa del correo en ${equipo}`} sandbox="" srcDoc={html}
              style={{ width: ancho, height: alto, transform: `scale(${escala})`, transformOrigin: "top left", border: 0 }} />
          </div>
        </div>
      )}
    </div>
  );
}

export function VistaCorreo({ asunto, html }: { asunto: string; html: string }) {
  const [equipo, setEquipo] = useState<Equipo>("celular");
  const [grande, setGrande] = useState(false);
  // Alto disponible en la ventana, para que la vista grande quepa entera.
  const [altoVentana, setAltoVentana] = useState(800);
  useEffect(() => {
    if (!grande) return;
    const medir = () => setAltoVentana(window.innerHeight);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [grande]);
  useEffect(() => {
    if (!grande) return;
    const cerrar = (e: KeyboardEvent) => { if (e.key === "Escape") setGrande(false); };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [grande]);

  const selector = (
    <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 text-xs">
      {([["celular", "Celular", Smartphone], ["computador", "Computador", Monitor]] as const).map(([k, t, Icono]) => (
        <button key={k} type="button" aria-pressed={equipo === k} onClick={() => setEquipo(k)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold ${equipo === k ? "bg-brand-blue text-white" : "text-gray-500"}`}>
          <Icono className="h-3.5 w-3.5" /> {t}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {selector}
        <button type="button" onClick={() => setGrande(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"><Maximize2 className="h-3.5 w-3.5" /> Ver en grande</button>
      </div>
      <div className={equipo === "celular" ? "mx-auto max-w-[340px]" : ""}>
        <Marco key={equipo} equipo={equipo} asunto={asunto} html={html} />
      </div>
      {/* Sobre toda la página (fuera del contenido), para que el menú no la tape ni la recorte. */}
      {grande && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Vista previa del correo" className="fixed inset-0 z-[1000] flex flex-col items-center gap-3 overflow-auto bg-black/80 p-4" style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }} onClick={() => setGrande(false)}>
          <div className="mx-auto flex w-full max-w-5xl flex-shrink-0 items-center justify-between" onClick={(e) => e.stopPropagation()}>
            {selector}
            <button type="button" onClick={() => setGrande(false)} aria-label="Cerrar" className="rounded-full bg-white p-2 text-gray-700"><X className="h-5 w-5" /></button>
          </div>
          <div className={`mx-auto w-full flex-shrink-0 ${equipo === "celular" ? "max-w-[440px]" : "max-w-5xl"}`} onClick={(e) => e.stopPropagation()}>
            <Marco key={`g-${equipo}`} equipo={equipo} asunto={asunto} html={html} maxAlto={Math.max(360, altoVentana - 110)} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
