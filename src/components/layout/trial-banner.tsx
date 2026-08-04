"use client";

import { useTenant } from "@/lib/tenant-context";

export function TrialBanner() {
  const { tenant, daysLeft, isTrialExpired } = useTenant();

  // Don't show if no tenant, or not in trial
  if (!tenant || tenant.status !== "trial") return null;

  if (isTrialExpired) {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-center gap-3">
        <span className="text-sm text-red-700 font-medium">
          ⚠️ Tu periodo de prueba ha expirado. Elige un plan para seguir usando re-booking.
        </span>
        <a href="/dashboard/configuracion" className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700">
          Ver planes
        </a>
      </div>
    );
  }

  if (daysLeft <= 5) {
    return (
      <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center justify-center gap-3">
        <span className="text-sm text-orange-700 font-medium">
          ⏰ Te quedan <strong>{daysLeft} dias</strong> de prueba gratuita
        </span>
        <a href="/dashboard/configuracion" className="px-3 py-1 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700">
          Elegir plan
        </a>
      </div>
    );
  }

  if (daysLeft <= 10) {
    return (
      <div className="bg-brand-blue/5 border-b border-brand-blue/20 px-4 py-2 flex items-center justify-center gap-2">
        <span className="text-xs text-brand-blue">
          🎁 Periodo de prueba: <strong>{daysLeft} dias restantes</strong>
        </span>
      </div>
    );
  }

  return null;
}
