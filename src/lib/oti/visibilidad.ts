"use client";
import { useSyncExternalStore } from "react";

// Si la burbuja de Oti se ve o no. Es SOLO de esta sesion: cada vez que se abre la app, Oti vuelve a estar visible (nunca se guarda oculto).
// Lo comparten la burbuja y el menu lateral (para volver a abrirlo).
let visible = true;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
export const otiVisible = () => visible;
export function ocultarOti() { if (visible) { visible = false; avisar(); } }
export function mostrarOti() { if (!visible) { visible = true; avisar(); } }
export function useOtiVisible(): boolean {
  return useSyncExternalStore((cb) => { oyentes.add(cb); return () => { oyentes.delete(cb); }; }, () => visible, () => true);
}
// Abre el panel de Oti (y muestra la burbuja si estaba oculta).
export function abrirPanelOti() { mostrarOti(); try { window.dispatchEvent(new Event("oti-abrir")); } catch {} }

// Posicion de la burbuja (solo comodidad; si el navegador no deja guardar, vuelve a la posicion de siempre).
export interface PosicionOti { lado: "left" | "right"; y: number } // y = fraccion de la altura (0..1) del centro de la burbuja
const CLAVE = "oti-posicion-v1";
export function leerPosicion(): PosicionOti | null {
  try { const r = JSON.parse(localStorage.getItem(CLAVE) || "null"); if ((r?.lado === "left" || r?.lado === "right") && typeof r.y === "number" && r.y >= 0 && r.y <= 1) return r; } catch {}
  return null;
}
export function guardarPosicion(p: PosicionOti) { try { localStorage.setItem(CLAVE, JSON.stringify(p)); } catch {} }
