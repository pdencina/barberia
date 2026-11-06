"use client";

import { MapPin } from "lucide-react";
import { useBranch } from "@/lib/branch-context";

// «Estás en X · Ir a Y»: cambia de sucursal en el Dashboard. No aparece si el negocio tiene una sola sucursal.
export function BranchBar() {
  const { branches, activeBranch, setBranch, loading } = useBranch();
  if (loading || branches.length <= 1 || !activeBranch) return null;
  const otras = branches.filter((b) => b.id !== activeBranch.id);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-gray-100 bg-white px-4 py-2.5">
      <span className="flex items-center gap-2 text-sm text-brand-dark">
        <MapPin className="h-4 w-4 text-brand-blue" strokeWidth={1.75} />
        Estás en <b>{activeBranch.name}</b>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {otras.map((o) => (
          <button key={o.id} type="button" onClick={() => setBranch(o.id)}
            className="rounded-full border border-brand-blue/30 px-3 py-1 text-xs font-semibold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white">
            Ir a {o.name} →
          </button>
        ))}
      </span>
      {!activeBranch.principal && (
        <span className="w-full text-[11px] text-brand-gray">Aquí solo se ven las ventas y citas de los profesionales asignados a esta sucursal (se asignan en Profesionales).</span>
      )}
    </div>
  );
}
