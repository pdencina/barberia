"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Ventanas emergentes de todo el panel: (1) «atrás» del celular y la tecla Esc las cierran en vez de sacar a la persona de la
// pantalla; (2) si no hay botón para cerrar a la mano, igual se puede salir. Detecta cualquier ventana (capa fija oscura) que aparezca
// y, al pedir cerrar, aprieta su botón Cancelar/Cerrar/× o, si no tiene, toca el fondo. No decide nada por la persona: nunca aprieta
// «Guardar», «Confirmar» ni «Sí». El calendario tiene su propio manejo (más fino) y se omite.
const SEL = '[class*="fixed"][class*="inset-0"][class*="bg-black"]';
const CERRAR = /^(cancelar|cerrar|×|✕|x|volver|no, volver|cerrar ventana|descartar)$/i;

function ventanasAbiertas(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(SEL)).filter((el) => {
    if (el.className.toString().includes("lg:hidden")) return false; // fondo del menú lateral
    if (el.children.length === 0) return false;                      // telón sin contenido (paleta de comandos, etc.)
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none";
  });
}

function cerrarLaDeArriba(): boolean {
  const lista = ventanasAbiertas();
  const top = lista[lista.length - 1];
  if (!top) return false;
  const boton = Array.from(top.querySelectorAll<HTMLButtonElement>("button")).find((b) => CERRAR.test((b.textContent || "").trim()) || /cerrar/i.test(b.getAttribute("aria-label") || ""));
  if (boton) boton.click(); else top.click(); // sin botón: se toca el fondo (casi todas se cierran así)
  return true;
}

export function ModalGuard() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname?.startsWith("/dashboard/calendario")) return;
    let empujado = false, ignorarPop = false, timer: ReturnType<typeof setTimeout> | null = null;

    const sync = () => {
      const hay = ventanasAbiertas().length > 0;
      if (hay && !empujado) {
        try { window.history.pushState({ ...(window.history.state || {}), rbGuard: 1 }, ""); empujado = true; } catch { /* sin historial */ }
      } else if (!hay && empujado) {
        empujado = false;
        if (window.history.state?.rbGuard) { ignorarPop = true; try { window.history.back(); } catch { ignorarPop = false; } setTimeout(() => { ignorarPop = false; }, 400); }
      }
    };
    const onMut = () => { if (timer) clearTimeout(timer); timer = setTimeout(sync, 30); };
    const obs = new MutationObserver(onMut);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    const onPop = () => {
      if (ignorarPop) { ignorarPop = false; return; }
      if (!empujado) return;
      empujado = false;
      cerrarLaDeArriba();
      setTimeout(sync, 60); // si sigue alguna abierta (o no se pudo cerrar), se vuelve a proteger el «atrás»
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && ventanasAbiertas().length) cerrarLaDeArriba(); };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    sync();
    return () => { obs.disconnect(); if (timer) clearTimeout(timer); window.removeEventListener("popstate", onPop); window.removeEventListener("keydown", onKey); };
  }, [pathname]);
  return null;
}
