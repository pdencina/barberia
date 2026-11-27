"use client";

import { useEffect, useState } from "react";
import { fondoParaLogo } from "@/lib/correo-colores";

/** Revisa el logo contra el fondo: devuelve el color de recuadro que necesita para verse, o null (también si no se puede leer). */
export function useFondoLogo(url: string | null | undefined, fondo: string): string | null {
  const [recuadro, setRecuadro] = useState<string | null>(null);
  useEffect(() => {
    setRecuadro(null);
    if (!url) return;
    let vigente = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        const k = Math.min(1, 120 / Math.max(img.width, img.height));
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        const x = c.getContext("2d");
        if (!x) return;
        x.drawImage(img, 0, 0, c.width, c.height);
        if (vigente) setRecuadro(fondoParaLogo(x.getImageData(0, 0, c.width, c.height).data, fondo));
      } catch { /* imagen sin permiso de lectura: queda la casilla manual */ }
    };
    img.src = `${url}${url.includes("?") ? "&" : "?"}lectura=1`;
    return () => { vigente = false; };
  }, [url, fondo]);
  return recuadro;
}
