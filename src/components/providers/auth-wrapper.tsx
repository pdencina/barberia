"use client";

import { AuthProvider } from "@/lib/auth-context";
import { BranchProvider } from "@/lib/branch-context";
import { TenantProvider } from "@/lib/tenant-context";
import { ProtectedRoute } from "@/components/layout/protected-route";

interface AuthWrapperProps {
  children: React.ReactNode;
  serverRole?: string;
  serverUserId?: string;
  serverEmail?: string;
  serverName?: string;
  serverTenantId?: string | null;
}

export function AuthWrapper({ children, serverRole, serverUserId, serverEmail, serverName, serverTenantId }: AuthWrapperProps) {
  return (
    <AuthProvider serverRole={serverRole} serverUserId={serverUserId} serverEmail={serverEmail} serverName={serverName}>
      <TenantProvider serverTenantId={serverTenantId}>
        <BranchProvider>
          <ProtectedRoute>
            {children}
          </ProtectedRoute>
        </BranchProvider>
      </TenantProvider>
    </AuthProvider>
  );
}
