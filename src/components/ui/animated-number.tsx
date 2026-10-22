"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

// Muestra un numero y, cuando cambia, lo anima desde lo que se veia hasta el nuevo valor.
// La primera vez se muestra directo (sin partir de 0). Respeta "reducir movimiento" del sistema.
export function AnimatedNumber({
  value,
  format = (n: number) => String(Math.round(n)),
  duration = 0.8,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const targetRef = useRef(value);

  useEffect(() => {
    if (targetRef.current === value) return;
    targetRef.current = value;
    const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !Number.isFinite(value)) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const controls = animate(shownRef.current, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => { shownRef.current = v; setShown(v); },
      onComplete: () => { shownRef.current = value; setShown(value); },
    });
    return () => controls.stop();
  }, [value, duration]);

  return <>{format(shown)}</>;
}
