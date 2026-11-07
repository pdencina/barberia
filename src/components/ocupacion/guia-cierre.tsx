"use client";

import Link from "next/link";
import type { CierreCitas } from "@/lib/ocupacion";

const PASOS: { n: number; titulo: string; texto: string; donde?: { href: string; label: string } }[] = [
  { n: 1, titulo: "Agenda la cita", texto: "Cada cliente que va a venir debe estar en el Calendario: lo agendas tú, o él reserva desde tu link. Así queda «Agendada».", donde: { href: "/dashboard/calendario", label: "Ir al Calendario" } },
  { n: 2, titulo: "El cliente llega y se atiende", texto: "No hace falta tocar nada mientras lo atiendes." },
  { n: 3, titulo: "Cóbralo en el Punto de Venta o en el Calendario", texto: "Al terminar, cobra desde el Punto de Venta, o desde el Calendario tocando el nombre del cliente y eligiendo «Cobrar». Elige al cliente y al profesional. Al cobrar, la cita se cierra sola como «Completada».", donde: { href: "/dashboard/pos", label: "Ir al Punto de Venta" } },
  { n: 4, titulo: "Si no llegó o canceló, márcalo", texto: "Marca «No llegó», o elimina la cita desde el Calendario y en el motivo de cancelación explica qué pasó. Nunca la dejes «Agendada» después de su hora." },
];

// Explica el proceso correcto para que los datos (ocupación, comisiones, caja, asistencia de clientes) se vean bien en todo el sistema.
export function GuiaCierre({ cierre, onVerIgual }: { cierre?: CierreCitas; onVerIgual?: () => void }) {
  return (
    <div className="space-y-4">
      {cierre && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:p-5">
          <p className="text-sm font-bold text-amber-800">Todavía no podemos medir bien tu ocupación</p>
          <p className="mt-1 text-sm text-amber-900">
            Hay {cierre.abiertas} citas pasadas que siguen «agendadas» o «confirmadas», y solo {cierre.cerradas} se cerraron bien. Si las citas no se cierran, el sistema cree que esas horas estuvieron vacías y los números salen más bajos que la realidad.
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-amber-100" title={`${cierre.pct}% de las citas pasadas están cerradas`}>
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${cierre.pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-amber-800"><b>{cierre.pct}%</b> de las citas se cierran. Para ver tu ocupación con confianza necesitamos al menos <b>70%</b>.</p>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
        <h2 className="text-base font-bold text-brand-dark">Así se usa re-booking para que todo cuadre</h2>
        <p className="mt-0.5 text-sm text-brand-gray">Cerrar cada cita toma 10 segundos y hace que todo lo demás funcione: ocupación, ventas por profesional, comisiones, caja y la asistencia de cada cliente.</p>
        <ol className="mt-4 space-y-3">
          {PASOS.map((p) => (
            <li key={p.n} className="flex gap-3 rounded-xl border border-gray-100 p-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white">{p.n}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brand-dark">{p.titulo}</p>
                <p className="mt-0.5 text-sm text-brand-gray">{p.texto}</p>
                {p.donde && <Link href={p.donde.href} className="mt-1.5 inline-block text-xs font-semibold text-brand-blue hover:underline">{p.donde.label} →</Link>}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800"><b>Sí:</b> cobrar siempre en el Punto de Venta con el cliente y el profesional correctos. Así quedan la venta, la comisión, la caja y la cita cerrada, todo junto.</div>
          <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700"><b>No:</b> cobrar por fuera, o cobrar sin elegir al cliente. La plata entra pero la cita queda abierta y la ocupación no se mueve.</div>
        </div>
        {onVerIgual && (
          <button type="button" onClick={onVerIgual} className="mt-4 text-xs font-semibold text-brand-gray underline hover:text-brand-dark">Ver los números igual (pueden salir bajos)</button>
        )}
      </div>
    </div>
  );
}
