"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, X } from "lucide-react";

// Aviso discreto en el Dashboard (administrador y recepcionista): "se estan agotando los correos". Aparece desde el 80% del
// cupo mensual de correos o del tope de difusion; en rojo suave. Se puede cerrar y vuelve en la siguiente sesion.
// Misma fuente que la barra de Configuracion (GET /api/message-quota). No consume cupo.

interface Status { limit: number | null; used: number; remaining: number | null }
interface Datos { email: Status | null; broadcast: Status | null; modo: { prueba: boolean; bloqueaDesde: string | null } | null }

const UMBRAL = 0.8;
const fecha = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("es-CL", { timeZone: "UTC", day: "numeric", month: "long" });
const llega = (s: Status | null | undefined) => !!s && s.limit !== null && s.limit > 0 && s.used / s.limit >= UMBRAL;

export function AvisoCorreos() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    try { if (sessionStorage.getItem("aviso-correos-cerrado") === "1") setCerrado(true); } catch { /* sin almacenamiento: se muestra */ }
    fetch("/api/message-quota")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDatos(d && !d.error ? d : null))
      .catch(() => setDatos(null));
  }, []);

  if (cerrado || !datos) return null;
  const general = llega(datos.email), difusion = llega(datos.broadcast);
  if (!general && !difusion) return null;

  const agotado = (general && (datos.email!.remaining ?? 1) <= 0) || (difusion && (datos.broadcast!.remaining ?? 1) <= 0);
  const detalle = [
    general ? `Correos: ${datos.email!.used} de ${datos.email!.limit}` : null,
    difusion ? `Difusión: ${datos.broadcast!.used} de ${datos.broadcast!.limit}` : null,
  ].filter(Boolean).join(" · ");
  const prueba = datos.modo?.prueba === true;
  const pie = prueba && datos.modo?.bloqueaDesde
    ? `Hoy es un periodo de prueba y no se corta nada. Desde el ${fecha(datos.modo.bloqueaDesde)} se pausarán los envíos al llegar al límite.`
    : "Al llegar al límite, los envíos se pausan hasta el próximo ciclo.";

  const cerrar = () => { setCerrado(true); try { sessionStorage.setItem("aviso-correos-cerrado", "1"); } catch { /* ignorar */ } };

  return (
    <div role="status" className="mb-3 flex items-start gap-3 rounded-2xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-red-700/80 md:mb-4">
      <Mail className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <p className="font-semibold">{agotado ? "Se agotaron los correos de este mes" : "Se están agotando los correos de este mes"}</p>
        <p className="mt-0.5 opacity-90">{detalle}. {pie}{" "}<Link href="/dashboard/configuracion" className="font-semibold underline underline-offset-2">Ver plan</Link></p>
      </div>
      <button type="button" onClick={cerrar} aria-label="Cerrar aviso" className="flex-shrink-0 rounded-full p-1 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
    </div>
  );
}
