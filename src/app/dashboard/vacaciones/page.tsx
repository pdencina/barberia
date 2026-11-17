"use client";

import { useAuth } from "@/lib/auth-context";
import { VistaProfesional } from "@/components/vacaciones/vista-profesional";
import { VistaAdmin } from "@/components/vacaciones/vista-admin";

// Vacaciones. El profesional pide las suyas en un calendario; el administrador las acepta, agrega las que quiera y define las reglas.
// Las vacaciones aprobadas bloquean la agenda y la reserva online de ese profesional (ver src/lib/vacations.ts).
export default function VacacionesPage() {
  const { role } = useAuth();
  const esProfesional = role === "barber";
  return (
    <div className="p-3 md:p-6 space-y-3 md:space-y-4 max-w-3xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-brand-dark">{esProfesional ? "Mis vacaciones" : "Vacaciones"}</h1>
        <p className="text-sm text-brand-gray">{esProfesional ? "Pide tus vacaciones en el calendario y tu administrador las acepta." : "Esos días el profesional no aparece en la reserva online y su agenda queda bloqueada."}</p>
      </div>
      {esProfesional ? <VistaProfesional /> : <VistaAdmin />}
    </div>
  );
}
