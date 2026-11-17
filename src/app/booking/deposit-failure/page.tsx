"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { enlaceDeVuelta } from "@/lib/volver-reserva";

export default function DepositFailurePage() {
  const [volver, setVolver] = useState({ href: "/booking", ref: null as string | null });
  const [negocio, setNegocio] = useState<{ name: string; phone: string | null } | null>(null);
  useEffect(() => {
    const v = enlaceDeVuelta(window.location.search);
    setVolver(v);
    // Contacto del negocio (si el link trae su nombre): para pedir ayuda por WhatsApp si el pago no pasa.
    const slug = new URLSearchParams(window.location.search).get("n");
    if (slug) fetch(`/api/public/business-info?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => { if (d?.name) setNegocio({ name: d.name, phone: d.phone || null }); }).catch(() => {});
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
        <p className="text-brand-gray text-sm mb-4">
          No pudimos procesar el pago, así que tu cita aún no está confirmada. No se te cobró nada.
        </p>
        <div className="mb-5 rounded-xl bg-gray-50 p-3 text-left text-xs text-brand-gray">
          <p className="mb-1 font-semibold text-brand-dark">¿Qué puedes hacer?</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Revisa que el saldo o cupo alcance y que los datos de la tarjeta estén bien escritos.</li>
            <li>Prueba con <b>otra tarjeta</b> o con otro medio de pago (débito, saldo de Mercado Pago).</li>
            <li>Si te rechazó varias veces, Mercado Pago puede bloquear la tarjeta por seguridad: <b>no insistas con la misma</b>, usa otra o espera un rato.</li>
            <li>Si sigue sin resultar, escríbenos y te ayudamos a reservar.</li>
          </ul>
        </div>
        <Link href={volver.href}
          className="inline-block px-6 py-3 bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-blue/90 transition-colors">
          Intentar de nuevo
        </Link>
        {negocio?.phone && (
          <a href={`https://wa.me/${negocio.phone.replace(/\D/g, "").replace(/^0/, "56").replace(/^(?!56)/, "56")}?text=${encodeURIComponent(`Hola ${negocio.name}, intenté reservar y el pago del abono no se completó. ¿Me ayudan a agendar mi hora?`)}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-3 block rounded-xl border border-green-600 px-6 py-3 text-sm font-semibold text-green-700 hover:bg-green-50">
            Escribir a {negocio.name} por WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
