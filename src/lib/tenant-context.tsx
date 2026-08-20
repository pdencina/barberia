"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { setTenantId as setGlobalTenantId } from "@/lib/api-fetch";

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  max_professionals: number;
  max_branches: number;
  trial_ends_at: string | null;
}

interface TenantContextType {
  tenant: TenantInfo | null;
  loading: boolean;
  isTrialExpired: boolean;
  daysLeft: number;
  hasPlanFeature: (feature: string) => boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  loading: true,
  isTrialExpired: false,
  daysLeft: 0,
  hasPlanFeature: () => true,
});

export function TenantProvider({ children, serverTenantId }: { children: ReactNode; serverTenantId?: string | null }) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [planFeatures, setPlanFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverTenantId) {
      // No tenant (super admin or old users without tenant)
      setLoading(false);
      return;
    }

    fetch(`/api/tenant/info?tenantId=${serverTenantId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.tenant) {
          setTenant(data.tenant);
          setPlanFeatures(data.features || []);
          setGlobalTenantId(data.tenant.id);
        }
      })
      .finally(() => setLoading(false));
  }, [serverTenantId]);

  const daysLeft = tenant?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isTrialExpired = tenant?.status === "trial" && daysLeft <= 0;

  const hasPlanFeature = (feature: string): boolean => {
    if (!tenant) return true; // No tenant = super admin = all features
    return planFeatures.includes(feature);
  };

  return (
    <TenantContext.Provider value={{ tenant, loading, isTrialExpired, daysLeft, hasPlanFeature }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
