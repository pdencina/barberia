"use client";

import Link from "next/link";

export default function DepositPendingPage() {
  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <img src="/logo-icon.png" alt="re-booking" className="w-16 h-16 mx-auto mb-4" />
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-brand-dark mb-2">Pago pendiente</h1>
        <p className="text-brand-gray text-sm mb-6">
          Tu pago esta siendo procesado. Te notificaremos por email cuando se confirme tu cita.
        </p>
        <Link href="/booking"
          className="inline-block px-6 py-3 bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-blue/90 transition-colors">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
