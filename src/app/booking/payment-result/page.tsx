"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const appointmentId = searchParams.get("appointment");

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {status === "success" ? (
          <>
            <div className="w-20 h-20 rounded-full bg-green-600/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-3">Pago Exitoso!</h1>
            <p className="text-gray-400 mb-6">Tu cita ha sido confirmada y pagada. Te esperamos!</p>
            <a href="/booking" className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 inline-block">
              Volver al inicio
            </a>
          </>
        ) : status === "pending" ? (
          <>
            <div className="w-20 h-20 rounded-full bg-yellow-600/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-3">Pago Pendiente</h1>
            <p className="text-gray-400 mb-6">Tu pago esta siendo procesado. Te notificaremos cuando se confirme.</p>
            <a href="/booking" className="px-6 py-3 border border-gray-700 text-gray-300 rounded-lg hover:border-red-500 inline-block">
              Volver al inicio
            </a>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-3">Pago No Completado</h1>
            <p className="text-gray-400 mb-6">Hubo un problema con el pago. Tu cita fue agendada pero no pagada. Puedes pagar en el local.</p>
            <a href="/booking" className="px-6 py-3 border border-gray-700 text-gray-300 rounded-lg hover:border-red-500 inline-block">
              Volver al inicio
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <PaymentResultContent />
    </Suspense>
  );
}
