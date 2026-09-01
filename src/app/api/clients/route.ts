import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId, resolveTenantForRequest } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  // Never trust the tenantId coming from the browser — see resolveTenantForRequest.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));

  // If no tenant can be determined, return empty (security: never show all data)
  // EXCEPT: super_admin ("ALL") can see everything
  if (!tenantId) {
    return NextResponse.json({ clients: [], total: 0, page: 1, totalPages: 0 });
  }

  // Build query
  let query = supabase.from("clients").select("*", { count: "exact" }).order("name");

  // Only filter by tenant if not super_admin
  if (tenantId !== "ALL") {
    query = query.eq("tenant_id", tenantId);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ clients: [], total: 0, page, totalPages: 0 });

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    clients: data || [],
    total,
    page,
    limit,
    totalPages,
  });
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { name, email, phone, notes, tenantId } = body;

  // Always resolve tenant_id: prefer param, fallback to session
  let resolvedTenantId = tenantId;
  if (!resolvedTenantId) {
    resolvedTenantId = await getCurrentTenantId();
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({ name, email: email || null, phone: phone || null, notes, tenant_id: resolvedTenantId || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
