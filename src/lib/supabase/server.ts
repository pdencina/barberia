import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function createServerSupabase() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder",
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {}
        },
      },
    }
  );
}

// Admin client with service role (bypasses RLS, no cookies needed)
export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Resolve the current caller's role + tenant for server-side authorization checks.
// Uses getUser() (validated) and falls back to getSession(). Returns nulls if unknown.
export async function getCurrentUserRoleAndTenant(): Promise<{
  userId: string | null;
  role: string | null;
  tenantId: string | null;
}> {
  try {
    const supabase = createServerSupabase();
    let userId: string | null = null;

    const { data: userData } = await supabase.auth.getUser();
    userId = userData.user?.id || null;
    if (!userId) {
      const { data: sessionData } = await supabase.auth.getSession();
      userId = sessionData.session?.user?.id || null;
    }
    if (!userId) return { userId: null, role: null, tenantId: null };

    const admin = createAdminSupabase();
    const { data: profile } = await admin
      .from("profiles")
      .select("role, tenant_id")
      .eq("id", userId)
      .single();

    return { userId, role: profile?.role || null, tenantId: profile?.tenant_id || null };
  } catch {
    return { userId: null, role: null, tenantId: null };
  }
}

// Server-side role gate for business-wide data (reports, dashboard, finances).
// Returns true only if the caller is an owner/manager-level role. A professional
// (barber) or client must never get whole-business figures from these endpoints —
// blocking it in the UI is not enough, the API itself has to refuse.
export async function isManagerLevel(): Promise<{ ok: boolean; role: string | null; tenantId: string | null; userId: string | null }> {
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  const ok = role === "admin" || role === "super_admin" || role === "receptionist";
  return { ok, role, tenantId, userId };
}

// Authorize a client-supplied tenantId before using it in a query.
//
// SECURITY: API routes used to take `?tenantId=` straight from the browser and query
// with it, with no check that the caller belongs to that business. That let any signed-in
// user read another business's clients, services, sales and settings just by changing
// the id — and it's what actually caused the leak where an Estudio Levels admin saw
// Saray Business clients and services (a stale super_admin tenant override left in
// localStorage kept sending the other business's id, and the API answered happily).
//
// Rules:
//   - super_admin: may target any business (that's the whole point of the role), or
//     "ALL" when no specific one is requested.
//   - everyone else: the requested id is IGNORED and replaced by the caller's own
//     tenant. Fail-safe by design — a wrong/stale id can never widen access, it just
//     returns the caller's own data.
export async function resolveTenantForRequest(
  requestedTenantId?: string | null
): Promise<{ tenantId: string | null; role: string | null; denied: boolean }> {
  const { userId, role, tenantId: callerTenantId } = await getCurrentUserRoleAndTenant();

  if (!userId) return { tenantId: null, role: null, denied: true };

  if (role === "super_admin") {
    return { tenantId: requestedTenantId || "ALL", role, denied: false };
  }

  const denied = !!requestedTenantId && requestedTenantId !== callerTenantId;
  if (denied) {
    console.warn(
      `[tenant-guard] ${role} ${userId} requested tenant ${requestedTenantId} but belongs to ${callerTenantId}. Forcing own tenant.`
    );
  }

  return { tenantId: callerTenantId, role, denied };
}

// Get the current user's tenant_id from the session
// Returns: tenant_id string, "ALL" for super_admin, or null if can't determine
export async function getCurrentTenantId(): Promise<string | null> {
  try {
    const supabase = createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      // Try getUser as fallback
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const adminSupabase = createAdminSupabase();
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("tenant_id, role")
        .eq("id", user.id)
        .single();

      // Super admin sees everything
      if (profile?.role === "super_admin") return "ALL";
      return profile?.tenant_id || null;
    }

    const adminSupabase = createAdminSupabase();
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", session.user.id)
      .single();

    // Super admin sees everything
    if (profile?.role === "super_admin") return "ALL";
    return profile?.tenant_id || null;
  } catch (e) {
    console.error("getCurrentTenantId error:", e);
    return null;
  }
}
