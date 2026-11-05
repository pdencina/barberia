"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { enlaceDeVuelta } from "@/lib/volver-reserva";

export default function DepositFailurePage() {
  const [volver, setVolver] = useState({ href: "/booking", ref: null as string | null });
  useEffect(() => {
    const v = enlaceDeVuelta(window.location.search);
    setVolver(v);
    // El pago no se completó: se libera el horario reservado para que pueda reintentar de inmediato.
    if (v.ref) fetch("/api/booking/deposit-release", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: v.ref }) }).catch(() => {});
  }, []);
  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <img src="/logo-icon.png" alt="re-booking" className="w-16 h-16 mx-auto mb-4" />
        <div className="w-16 h-16 bg-brand-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-brand-dark mb-2">Tu pago no se completó</h1>
        <p className="text-brand-gray text-sm mb-6">
          No pudimos procesar el pago, así que tu cita aún no está confirmada. No se te cobró nada.
        </p>
        <p className="text-xs text-brand-gray mb-6">
          Puedes intentar nuevamente o elegir otro metodo de pago.
        </p>
        <Link href={volver.href}
          className="inline-block px-6 py-3 bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-blue/90 transition-colors">
          Intentar de nuevo
        </Link>
      </div>
    </div>
  );
}
