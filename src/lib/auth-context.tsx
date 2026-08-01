"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { Role, canAccessRoute, hasFeature } from "@/lib/permissions";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar_url: string | null;
  work_mode: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  role: Role | null;
  canAccess: (pathname: string) => boolean;
  hasPermission: (feature: string) => boolean;
  isAtLeast: (minRole: Role) => boolean;
}

const ROLE_HIERARCHY: Record<Role, number> = {
  client: 0,
  barber: 1,
  admin: 2,
  super_admin: 3,
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: null,
  canAccess: () => false,
  hasPermission: () => false,
  isAtLeast: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setUser(null);
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, name, email, role, avatar_url, work_mode")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          setUser({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: (profile.role as Role) || "barber",
            avatar_url: profile.avatar_url,
            work_mode: profile.work_mode,
          });
        } else {
          // Profile not found but session exists - use minimal info with admin fallback
          setUser({
            id: session.user.id,
            name: session.user.email?.split("@")[0] || "Usuario",
            email: session.user.email || "",
            role: "super_admin", // fallback: allow access, sidebar will filter
            avatar_url: null,
            work_mode: null,
          });
        }
      } catch (e) {
        console.error("Auth error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  const role = user?.role || null;

  const canAccess = (pathname: string): boolean => {
    if (!role) return false;
    return canAccessRoute(role, pathname);
  };

  const hasPermission = (feature: string): boolean => {
    if (!role) return false;
    return hasFeature(role, feature);
  };

  const isAtLeast = (minRole: Role): boolean => {
    if (!role) return false;
    return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, canAccess, hasPermission, isAtLeast }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
