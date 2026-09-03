"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/spinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, canAccess } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Not logged in → send to login
    if (!user) {
      router.replace("/login");
      return;
    }

    // Logged in but no access to this route → redirect based on role.
    if (!canAccess(pathname)) {
      if (user.role === "client" && pathname.startsWith("/dashboard")) {
        router.replace("/booking");
      } else if (user.role === "barber") {
        // A professional landing on "/dashboard" (business-wide home) or any
        // admin-only page gets sent to their own agenda. They no longer have the
        // "/dashboard" wildcard, so this now correctly fires for them.
        router.replace("/dashboard/mi-agenda");
      }
      // admins/super_admins have the /dashboard wildcard, so no redirect needed
    }
  }, [user, loading, pathname]);

  // While loading, show children anyway (server already validated session)
  // This prevents blank screen flash
  if (loading) {
    return <>{children}</>;
  }

  // If no user after loading, show nothing (redirect is happening)
  if (!user) return null;

  // Client role should never see dashboard
  if (user.role === "client" && pathname.startsWith("/dashboard")) {
    return null; // redirect happening via useEffect
  }

  // If no access, show restriction message briefly
  if (!canAccess(pathname)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-6xl">🔒</div>
        <h2 className="text-xl font-bold text-gray-800">Acceso restringido</h2>
        <p className="text-gray-500 text-sm">No tienes permisos para acceder a esta seccion.</p>
      </div>
    );
  }

  return <>{children}</>;
}
