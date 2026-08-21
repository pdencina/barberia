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
  // Switch tenant (super_admin feature)
  isOverriding: boolean;
  switchTenant: (tenantId: string, tenantName: string) => void;
  exitTenant: () => void;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  loading: true,
  isTrialExpired: false,
  daysLeft: 0,
  hasPlanFeature: () => true,
  isOverriding: false,
  switchTenant: () => {},
  exitTenant: () => {},
});

export function TenantProvider({ children, serverTenantId }: { children: ReactNode; serverTenantId?: string | null }) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [planFeatures, setPlanFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Read override from localStorage synchronously on init
  const getInitialOverride = (): string | null => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("tenant_override");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.tenantId || null;
      }
    } catch {}
    return null;
  };

  const [overrideTenantId, setOverrideTenantId] = useState<string | null>(getInitialOverride);
  const [isOverriding, setIsOverriding] = useState(!!getInitialOverride());

  // Determine which tenant to load: override > server-provided
  const activeTenantId = overrideTenantId || serverTenantId;

  useEffect(() => {
    if (!activeTenantId) {
      // No tenant (super admin without override)
      setTenant(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/tenant/info?tenantId=${activeTenantId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.tenant) {
          setTenant(data.tenant);
          setPlanFeatures(data.features || []);
          setGlobalTenantId(data.tenant.id);
        } else {
          setTenant(null);
        }
      })
      .finally(() => setLoading(false));
  }, [activeTenantId]);

  const switchTenant = (tenantId: string, tenantName: string) => {
    localStorage.setItem("tenant_override", JSON.stringify({ tenantId, tenantName }));
    setOverrideTenantId(tenantId);
    setIsOverriding(true);
    // Force reload to refresh all data with new tenant
    window.location.reload();
  };

  const exitTenant = () => {
    localStorage.removeItem("tenant_override");
    setOverrideTenantId(null);
    setIsOverriding(false);
    setTenant(null);
    setGlobalTenantId(null);
    window.location.reload();
  };

  const daysLeft = tenant?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isTrialExpired = tenant?.status === "trial" && daysLeft <= 0;

  const hasPlanFeature = (feature: string): boolean => {
    if (!tenant) return true; // No tenant = super admin = all features
    return planFeatures.includes(feature);
  };

  return (
    <TenantContext.Provider value={{ tenant, loading, isTrialExpired, daysLeft, hasPlanFeature, isOverriding, switchTenant, exitTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
