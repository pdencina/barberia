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

    // Logged in but no access to this route → redirect based on role
    if (!canAccess(pathname)) {
      if (user.role === "barber") {
        // Barbers go to their calendar
        router.replace("/dashboard/calendario");
      } else if (user.role === "client") {
        // Clients go to booking
        router.replace("/booking");
      } else {
        // Admins fallback to dashboard home
        router.replace("/dashboard");
      }
    }
  }, [user, loading, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (!user) return null;

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
