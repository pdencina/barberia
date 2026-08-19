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

// Get the current user's tenant_id from the session
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
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      return profile?.tenant_id || null;
    }

    const adminSupabase = createAdminSupabase();
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", session.user.id)
      .single();

    return profile?.tenant_id || null;
  } catch (e) {
    console.error("getCurrentTenantId error:", e);
    return null;
  }
}
