"use client";

import { MapPin } from "lucide-react";
import { useBranch } from "@/lib/branch-context";

// Sucursal activa y botón para cambiar («Ir a Y →»), en una fila chica. No aparece si el negocio tiene una sola sucursal.
export function BranchBar() {
  const { branches, activeBranch, setBranch, loading } = useBranch();
  if (loading || branches.length <= 1 || !activeBranch) return null;
  const otras = branches.filter((b) => b.id !== activeBranch.id);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-1 text-xs font-bold text-brand-dark">
        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-brand-blue" strokeWidth={1.75} />
        <span className="truncate">{activeBranch.name}</span>
      </span>
      {otras.map((o) => (
        <button key={o.id} type="button" onClick={() => setBranch(o.id)}
          className="rounded-full border border-brand-blue/30 px-2.5 py-1 text-xs font-semibold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white">
          Ir a {o.name} →
        </button>
      ))}
      {!activeBranch.principal && (
        <span className="w-full text-[11px] text-brand-gray">Aquí solo se ven las ventas y citas de los profesionales asignados a esta sucursal (se asignan en Profesionales).</span>
      )}
    </div>
  );
}
