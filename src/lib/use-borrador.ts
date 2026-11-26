"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Borrador automático en este equipo: al entrar se recupera lo guardado y cada cambio se guarda solo.
 * `clave` null = todavía no se sabe de quién es (no se lee ni se escribe). `aplicar(null)` = volver a los valores iniciales.
 */
export function useBorrador<T>(clave: string | null, datos: T, aplicar: (guardado: Partial<T> | null) => void) {
  const [cargada, setCargada] = useState<string | null>(null);
  const [hayBorrador, setHayBorrador] = useState(false);
  const aplicarRef = useRef(aplicar);
  aplicarRef.current = aplicar;
  // La siguiente pasada de guardado se salta: es lo recién cargado (o recién borrado), no un cambio de la persona.
  const saltar = useRef(false);

  useEffect(() => {
    if (!clave) return;
    let guardado: Partial<T> | null = null;
    try { const raw = localStorage.getItem(clave); guardado = raw ? JSON.parse(raw) : null; } catch { guardado = null; }
    saltar.current = true;
    aplicarRef.current(guardado);
    setHayBorrador(!!guardado);
    setCargada(clave);
  }, [clave]);

  const json = JSON.stringify(datos);
  useEffect(() => {
    // Solo se guarda cuando ya se recuperó el borrador de ESTA clave (así nunca se pisa con los valores iniciales).
    if (!clave || cargada !== clave) return;
    if (saltar.current) { saltar.current = false; return; }
    try { localStorage.setItem(clave, json); setHayBorrador(true); } catch { /* sin almacenamiento */ }
  }, [clave, cargada, json]);

  const borrar = () => {
    if (clave) { try { localStorage.removeItem(clave); } catch { /* sin almacenamiento */ } }
    saltar.current = true;
    aplicarRef.current(null);
    setHayBorrador(false);
  };
  return { hayBorrador, borrar };
}
