"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { EmptyIcons, SuccessMark } from "@/components/ui/empty-state";

export default function CancelPage() {
  const params = useParams();
  const [status, setStatus] = useState<"confirm" | "loading" | "success" | "error">("confirm");
  const [errorMsg, setErrorMsg] = useState("");

  const handleCancel = async () => {
    setStatus("loading");

    const res = await fetch("/api/public/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: params.id }),
    });

    const data = await res.json();

    if (res.ok) {
      setStatus("success");
    } else {
      setErrorMsg(data.error || "Error al cancelar");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-xl p-6 text-center">
        <img src="/logo-horizontal.png" alt="re-booking" className="h-10 mx-auto mb-6" />

        {status === "confirm" && (
          <>
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 ring-4 ring-amber-100 flex items-center justify-center">
              <EmptyIcons.agendaEmpty className="w-6 h-6 text-amber-600" strokeWidth={1.75} />
            </div>
            <h2 className="text-lg font-bold text-brand-dark">Cancelar cita</h2>
            <p className="text-sm text-brand-gray mt-2 mb-6">
              Estas seguro que deseas cancelar tu cita? Esta accion no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <a href="/booking" className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-brand-gray hover:bg-gray-50 flex items-center justify-center">
                Volver
              </a>
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600"
              >
                Si, cancelar
              </button>
            </div>
          </>
        )}

        {status === "loading" && (
          <div className="py-8">
            <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-brand-gray mt-3">Cancelando...</p>
          </div>
        )}

        {status === "success" && (
          <>
            <SuccessMark size={64} className="mb-4" />
            <h2 className="text-lg font-bold text-brand-dark">Cita cancelada</h2>
            <p className="text-sm text-brand-gray mt-2 mb-6">
              Tu cita ha sido cancelada exitosamente. Puedes reagendar cuando quieras.
            </p>
            <a href="/booking" className="block w-full py-2.5 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700">
              Agendar nueva cita
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 ring-4 ring-red-100 flex items-center justify-center">
              <EmptyIcons.error className="w-6 h-6 text-red-500" strokeWidth={1.75} />
            </div>
            <h2 className="text-lg font-bold text-brand-dark">No se pudo cancelar</h2>
            <p className="text-sm text-red-500 mt-2 mb-6">{errorMsg}</p>
            <a href="/booking" className="block w-full py-2.5 border border-gray-200 rounded-xl text-sm text-brand-gray hover:bg-gray-50">
              Volver al inicio
            </a>
          </>
        )}
      </div>
    </div>
  );
}
