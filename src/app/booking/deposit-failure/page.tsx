"use client";

import Link from "next/link";

export default function DepositFailurePage() {
  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <img src="/logo-icon.png" alt="re-booking" className="w-16 h-16 mx-auto mb-4" />
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-brand-dark mb-2">Pago no procesado</h1>
        <p className="text-brand-gray text-sm mb-6">
          No pudimos procesar tu pago. Tu cita no fue confirmada.
        </p>
        <p className="text-xs text-brand-gray mb-6">
          Puedes intentar nuevamente o elegir otro metodo de pago.
        </p>
        <Link href="/booking"
          className="inline-block px-6 py-3 bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-blue/90 transition-colors">
          Intentar de nuevo
        </Link>
      </div>
    </div>
  );
}
