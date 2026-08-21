"use client";

import { useTenant } from "@/lib/tenant-context";
import { Building2, X } from "lucide-react";

export function TenantOverrideBanner() {
  const { tenant, isOverriding, exitTenant } = useTenant();

  if (!isOverriding || !tenant) return null;

  return (
    <div className="bg-gradient-to-r from-brand-blue to-brand-accent text-white px-4 py-2 flex items-center justify-center gap-3 text-sm relative z-50">
      <Building2 className="w-4 h-4 flex-shrink-0" />
      <span className="font-medium">
        Viendo como: <strong>{tenant.name}</strong>
      </span>
      <button
        onClick={exitTenant}
        className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
      >
        <X className="w-3 h-3" />
        Salir
      </button>
    </div>
  );
}
