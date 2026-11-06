"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Carrusel que se desliza con el dedo (táctil), con el mouse (arrastrando) o con la rueda/trackpad horizontal, y avanza solo.
// Los puntos o botones son un apoyo: la forma principal es deslizar. Cada «página» ocupa el ancho completo del contenedor.
export function useSnapCarousel(pageCount: number, autoplayMs = 3000) {
  const ref = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const [pausa, setPausa] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const reanudar = useRef<ReturnType<typeof setTimeout> | null>(null);

  const irA = useCallback((i: number) => {
    const el = ref.current;
    if (!el) return;
    const n = Math.max(0, Math.min(pageCount - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  }, [pageCount]);

  const alScroll = () => {
    const el = ref.current;
    if (!el || el.clientWidth === 0) return;
    const p = Math.round(el.scrollLeft / el.clientWidth);
    pageRef.current = p;
    setPage(p);
  };

  // Avanza solo, volviendo al principio al llegar al final; se detiene mientras se toca, arrastra o pasa el mouse.
  useEffect(() => {
    if (pageCount <= 1 || pausa || arrastrando) return;
    const t = setInterval(() => irA(pageRef.current + 1 >= pageCount ? 0 : pageRef.current + 1), autoplayMs);
    return () => clearInterval(t);
  }, [pageCount, pausa, arrastrando, autoplayMs, irA]);

  const termina = () => {
    const el = ref.current;
    if (!drag.current || !el) return;
    drag.current = null;
    setArrastrando(false);
    irA(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
  };

  const props = {
    ref,
    onScroll: alScroll,
    onMouseEnter: () => setPausa(true),
    onMouseLeave: () => { setPausa(false); termina(); },
    // Táctil: el navegador ya desliza solo; solo se pausa el avance automático un rato.
    onTouchStart: () => { setPausa(true); if (reanudar.current) clearTimeout(reanudar.current); },
    onTouchEnd: () => { if (reanudar.current) clearTimeout(reanudar.current); reanudar.current = setTimeout(() => setPausa(false), 4000); },
    // Mouse: arrastrar para deslizar.
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" || !ref.current) return;
      drag.current = { x: e.clientX, left: ref.current.scrollLeft };
      setArrastrando(true);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!drag.current || !ref.current) return;
      ref.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
    },
    onPointerUp: termina,
    onPointerCancel: termina,
  };

  return { props, page, irA, arrastrando };
}
