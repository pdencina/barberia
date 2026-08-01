"use client";

import { AuthProvider } from "@/lib/auth-context";
import { ProtectedRoute } from "@/components/layout/protected-route";

interface AuthWrapperProps {
  children: React.ReactNode;
  serverRole?: string;
  serverUserId?: string;
  serverEmail?: string;
  serverName?: string;
}

export function AuthWrapper({ children, serverRole, serverUserId, serverEmail, serverName }: AuthWrapperProps) {
  return (
    <AuthProvider serverRole={serverRole} serverUserId={serverUserId} serverEmail={serverEmail} serverName={serverName}>
      <ProtectedRoute>
        {children}
      </ProtectedRoute>
    </AuthProvider>
  );
}
