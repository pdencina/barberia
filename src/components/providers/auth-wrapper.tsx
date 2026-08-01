"use client";

import { AuthProvider } from "@/lib/auth-context";
import { ProtectedRoute } from "@/components/layout/protected-route";

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedRoute>
        {children}
      </ProtectedRoute>
    </AuthProvider>
  );
}
