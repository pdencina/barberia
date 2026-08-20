import { NextRequest } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";

/**
 * Get tenant_id from the request.
 * Priority: query param tenantId > session cookies > null
 * 
 * Usage in API routes:
 *   const tenantId = await getTenantFromRequest(req);
 *   if (!tenantId) return NextResponse.json([], { status: 200 });
 *   
 *   // Then use in queries:
 *   .eq("tenant_id", tenantId)
 */
export async function getTenantFromRequest(req: NextRequest): Promise<string | null> {
  // 1. Try query param (sent by frontend)
  const { searchParams } = new URL(req.url);
  const paramTenantId = searchParams.get("tenantId");
  if (paramTenantId) return paramTenantId;

  // 2. Try session cookies
  try {
    const supabase = createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    if (!userId) {
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
      .eq("id", userId)
      .single();
    return profile?.tenant_id || null;
  } catch {
    return null;
  }
}

/**
 * For API routes that don't have access to NextRequest (e.g. GET without params),
 * use this version that only reads from cookies.
 */
export async function getTenantFromSession(): Promise<string | null> {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const adminSupabase = createAdminSupabase();
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    return profile?.tenant_id || null;
  } catch {
    return null;
  }
}
