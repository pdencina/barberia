"use client";
// Pixel de Meta + aviso de cookies simple. Sin ID valido no muestra ni carga nada.
// Sirve para el Pixel de re-booking (variable de entorno) y para el Pixel propio de cada negocio (pixelId + business).
import { useEffect, useState } from "react";
import { META_PIXEL_ID, pixelEnabled, getConsent, setConsent, loadPixel, track, captureAttribution } from "@/lib/meta-pixel";

export default function MetaPixel({ viewContent, pixelId, business }: { viewContent?: string; pixelId?: string | null; business?: string }) {
  const id = pixelId ?? META_PIXEL_ID;
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!pixelEnabled(id)) return;
    captureAttribution();
    const c = getConsent();
    if (c === null) setAsk(true);
    if (c === "granted") fire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function fire() {
    if (!loadPixel(id)) return;
    track("PageView", undefined, undefined, id);
    if (viewContent) track("ViewContent", { content_name: viewContent }, undefined, id);
  }

  if (!ask || !pixelEnabled(id)) return null;
  const choose = (v: "granted" | "denied") => { setConsent(v); setAsk(false); if (v === "granted") fire(); };
  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-xl text-sm text-brand-dark">
      <p>{business ? `${business} usa cookies` : "Usamos cookies"} para mejorar tu experiencia y entender cómo se usa este sitio. No guardamos datos de salud.{" "}
        <a href={business ? "/privacidad/clientes" : "/privacidad"} className="underline" target="_blank" rel="noopener noreferrer">Más información</a>.</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => choose("denied")} className="h-10 flex-1 rounded-xl border border-gray-300 font-semibold">Rechazar</button>
        <button onClick={() => choose("granted")} className="h-10 flex-1 rounded-xl bg-brand-blue font-semibold text-white">Aceptar</button>
      </div>
    </div>
  );
}
