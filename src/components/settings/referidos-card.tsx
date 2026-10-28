"use client";

import { useEffect, useState } from "react";
import { Gift, Copy } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { REFERIDOS_ACTIVOS } from "@/lib/referidos";

interface Resumen { codigo: string; enlace: string; invitados: number; pagaron: number; premio: { referidoDescuentoPct: number; referidoMeses: number; invitadorMesesGratis: number } }

// Invitar a otro negocio. Etapa 1: se registra quien invita a quien; el descuento y el mes gratis se aplican en etapas siguientes.
// Solo se muestra con NEXT_PUBLIC_REFERIDOS=1 y a administradores (el servidor responde 403 a los demas).
export function ReferidosCard() {
  const { showToast } = useToast();
  const [r, setR] = useState<Resumen | null>(null);

  useEffect(() => {
    if (!REFERIDOS_ACTIVOS) return;
    fetch("/api/referidos", { cache: "no-store" }).then(async (res) => { if (res.ok) { const d = await res.json(); if (d?.codigo) setR(d); } }).catch(() => {});
  }, []);

  if (!REFERIDOS_ACTIVOS || !r) return null;
  const copiar = async () => { try { await navigator.clipboard.writeText(r.enlace); showToast("Enlace copiado", "success"); } catch { showToast("No pude copiar. Selecciona el enlace y cópialo.", "error"); } };

  return (
    <div className="rounded-2xl border border-brand-blue/30 bg-white p-5 space-y-3 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-brand-blue" />
        <p className="font-bold text-brand-dark dark:text-gray-100">Invita a otro negocio</p>
      </div>
      <p className="text-sm text-brand-gray">
        Si un negocio se suscribe con tu enlace, tú ganas <b>{r.premio.invitadorMesesGratis} mes gratis</b> y esa persona recibe <b>{r.premio.referidoDescuentoPct}% de descuento en sus primeros {r.premio.referidoMeses} meses</b>.
      </p>
      <div className="flex items-center gap-2">
        <input readOnly value={r.enlace} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-brand-dark dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
        <button type="button" onClick={copiar} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-3 py-2 text-xs font-semibold text-white"><Copy className="h-3.5 w-3.5" /> Copiar</button>
      </div>
      <p className="text-xs text-brand-gray">Tu código: <b>{r.codigo}</b> · Invitados: <b>{r.invitados}</b> · Ya pagaron: <b>{r.pagaron}</b></p>
    </div>
  );
}
