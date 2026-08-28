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
  receptionist: 2,
  admin: 3,
  super_admin: 4,
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: null,
  canAccess: () => false,
  hasPermission: () => false,
  isAtLeast: () => false,
});

interface AuthProviderProps {
  children: ReactNode;
  serverRole?: string;
  serverUserId?: string;
  serverEmail?: string;
  serverName?: string;
}

export function AuthProvider({ children, serverRole, serverUserId, serverEmail, serverName }: AuthProviderProps) {
  // Use server-provided data immediately (no loading flash)
  const [user, setUser] = useState<UserProfile | null>(
    serverRole && serverUserId
      ? {
          id: serverUserId,
          name: serverName || "Usuario",
          email: serverEmail || "",
          role: (serverRole as Role) || "admin",
          avatar_url: null,
          work_mode: null,
        }
      : null
  );
  const [loading, setLoading] = useState(!serverRole); // not loading if server provided data

  useEffect(() => {
    const supabase = createClient();

    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          // Client-side session may be unavailable on Vercel even for a valid user.
          // Do NOT wipe the server-provided user in that case — keep it as the truth.
          if (!serverRole || !serverUserId) setUser(null);
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
            // Trust the DB role; if somehow missing, fall back to the server-provided
            // role rather than blindly assuming admin (which would over-expose actions).
            role: (profile.role as Role) || (serverRole as Role) || "barber",
            avatar_url: profile.avatar_url,
            work_mode: profile.work_mode,
          });
        } else {
          // No profile row found. Preserve the server-provided role instead of
          // defaulting to admin, so barbers never get admin-only actions.
          setUser({
            id: session.user.id,
            name: serverName || session.user.email?.split("@")[0] || "Usuario",
            email: session.user.email || "",
            role: (serverRole as Role) || "barber",
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
