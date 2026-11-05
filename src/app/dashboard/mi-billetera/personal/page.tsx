"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { GastosPersonales } from "@/components/finance/gastos-personales";
import { AtajoVoz } from "@/components/finance/atajo-voz";
import { PresupuestoPersonal } from "@/components/finance/presupuesto-personal";

// Mis finanzas personales (privadas): sueldo, ahorro intocable, torta del mes, reporte con porcentajes y mis gastos (a mano o con Oti).
export default function FinanzasPersonalesPage() {
  return (
    <div className="p-3 md:p-6 max-w-2xl mx-auto space-y-3 md:space-y-5">
      <div>
        <Link href="/dashboard/mi-billetera" className="inline-flex items-center gap-1 text-xs font-medium text-brand-gray hover:text-brand-blue">
          <ChevronLeft className="h-3.5 w-3.5" /> Mi Billetera
        </Link>
        <h1 className="mt-1 text-xl md:text-2xl font-bold text-brand-dark">Mis gastos personales</h1>
        <p className="text-sm text-brand-gray">Solo tú ves esto: tu sueldo, tu ahorro y en qué gastas.</p>
      </div>
      <PresupuestoPersonal />
      <GastosPersonales />
      <AtajoVoz />
    </div>
  );
}
