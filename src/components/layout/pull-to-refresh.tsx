"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw, ArrowDown } from "lucide-react";
import { canPullRefresh, PullRefreshGesture, PULL_REFRESH } from "@/lib/pull-refresh";
import { clearAppCache } from "@/lib/swr-cache";

const INTERACTIVE = 'input,textarea,select,button,a,[contenteditable="true"],[draggable="true"],[data-barber-column],[data-appointment],[data-no-pull-refresh]';
const MODAL = '[role="dialog"],[aria-modal="true"],[data-pull-refresh-block],[class~="fixed"][class~="inset-0"]';

// Se monta dentro del <main> que realmente desplaza el panel. La navegación completa vuelve a
// ejecutar también los fetch de páginas cliente (router.refresh por sí solo no los reejecuta).
export function PullToRefresh() {
  const pathname = usePathname();
  const indicator = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const main = indicator.current?.closest("main");
    if (!main || !canPullRefresh(pathname)) return;
    const gesture = new PullRefreshGesture();
    let busy = false, dirty = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let origin: HTMLElement | null = null;
    const previousOverscroll = main.style.overscrollBehaviorY;
    main.style.overscrollBehaviorY = "contain";
    setDistance(0); setRefreshing(false); setMessage("");
    const hasModal = () => !!document.querySelector(MODAL);
    const atTop = () => {
      if (main.scrollTop > 1) return false;
      for (let el = origin; el && el !== main; el = el.parentElement) {
        if (el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 1) return false;
      }
      return true;
    };
    const cancel = () => { gesture.cancel(); setDistance(0); origin = null; };
    const onStart = (e: TouchEvent) => {
      origin = e.target instanceof HTMLElement ? e.target : e.target instanceof Element ? e.target.parentElement : null;
      const touch = e.touches[0];
      if (!touch) return;
      gesture.begin(touch.clientX, touch.clientY, !busy && !dirty && atTop() && !hasModal() && !!origin && !origin.closest(INTERACTIVE), e.touches.length);
      setMessage("");
    };
    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || busy) return;
      if (dirty || hasModal() || e.defaultPrevented) { cancel(); return; }
      const next = gesture.move(touch.clientX, touch.clientY, atTop(), e.touches.length);
      if (gesture.active && e.cancelable) e.preventDefault();
      setDistance(next);
    };
    const onEnd = () => {
      const trigger = !busy && !dirty && !hasModal() && atTop() && gesture.release();
      cancel();
      if (!trigger) return;
      if (!navigator.onLine) { setMessage("Sin conexión. Intenta otra vez cuando vuelvas a tener internet."); return; }
      busy = true;
      setRefreshing(true);
      // Deja pintar el indicador antes de navegar; nunca repite escrituras ni guarda formularios.
      timer = setTimeout(() => { clearAppCache(); window.location.reload(); }, 120);
    };
    const onInput = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.closest("form")) { dirty = true; cancel(); }
    };
    main.addEventListener("touchstart", onStart, { passive: true });
    main.addEventListener("touchmove", onMove, { passive: false });
    main.addEventListener("touchend", onEnd);
    main.addEventListener("touchcancel", cancel);
    main.addEventListener("input", onInput);
    main.addEventListener("change", onInput);
    return () => {
      if (timer) clearTimeout(timer);
      main.style.overscrollBehaviorY = previousOverscroll;
      main.removeEventListener("touchstart", onStart); main.removeEventListener("touchmove", onMove);
      main.removeEventListener("touchend", onEnd); main.removeEventListener("touchcancel", cancel);
      main.removeEventListener("input", onInput); main.removeEventListener("change", onInput);
    };
  }, [pathname]);

  const ready = distance >= PULL_REFRESH.threshold;
  return <div ref={indicator} data-pull-refresh-indicator role="status" aria-live="polite" className="overflow-hidden text-brand-blue" style={{ height: refreshing ? 52 : message ? 44 : distance, transition: distance ? "none" : "height 160ms ease" }}>
    <div className="flex h-full min-h-8 items-center justify-center gap-2 px-3 text-xs font-semibold">
      {message || <>{refreshing ? <RefreshCw className="h-4 w-4 motion-safe:animate-spin"/> : <ArrowDown className={`h-4 w-4 transition-transform ${ready ? "rotate-180" : ""}`}/>}<span>{refreshing ? "Actualizando…" : ready ? "Suelta para actualizar" : distance > 0 ? "Desliza para actualizar" : ""}</span></>}
    </div>
  </div>;
}
