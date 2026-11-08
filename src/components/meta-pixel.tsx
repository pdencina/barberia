"use client";
// Píxel de Meta + aviso de cookies simple. Si NEXT_PUBLIC_META_PIXEL_ID está vacío no muestra ni carga nada.
import { useEffect, useState } from "react";
import { pixelEnabled, getConsent, setConsent, loadPixel, track, captureAttribution } from "@/lib/meta-pixel";

export default function MetaPixel({ viewContent }: { viewContent?: string }) {
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!pixelEnabled()) return;
    captureAttribution();
    const c = getConsent();
    if (c === null) setAsk(true);
    if (c === "granted") fire();
  }, []);

  function fire() {
    if (!loadPixel()) return;
    track("PageView");
    if (viewContent) track("ViewContent", { content_name: viewContent });
  }

  if (!ask) return null;
  const choose = (v: "granted" | "denied") => { setConsent(v); setAsk(false); if (v === "granted") fire(); };
  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-xl text-sm text-brand-dark">
      <p>Usamos cookies para medir qué anuncios te trajeron hasta aquí. No guardamos datos de salud.{" "}
        <a href="/privacidad" className="underline" target="_blank" rel="noopener noreferrer">Más información</a>.</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => choose("denied")} className="h-10 flex-1 rounded-xl border border-gray-300 font-semibold">Rechazar</button>
        <button onClick={() => choose("granted")} className="h-10 flex-1 rounded-xl bg-brand-blue font-semibold text-white">Aceptar</button>
      </div>
    </div>
  );
}
