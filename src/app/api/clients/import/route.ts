import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();

  // Bulk import is sensitive: only admin/super_admin. Imported clients are assigned to the
  // caller's tenant, and duplicate detection is scoped to that tenant.
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!role || !["admin", "super_admin"].includes(role)) {
    return NextResponse.json({ error: "No tienes permisos para importar clientes" }, { status: 403 });
  }

  const body = await req.json();
  const { clients, tenantId: bodyTenantId } = body; // array of { name, email, phone, notes }

  // super_admin may target a tenant explicitly; everyone else uses their own.
  const targetTenantId = role === "super_admin" ? (bodyTenantId || tenantId) : tenantId;
  if (!targetTenantId) {
    return NextResponse.json({ error: "No se pudo determinar el negocio destino" }, { status: 400 });
  }

  if (!clients || !Array.isArray(clients) || clients.length === 0) {
    return NextResponse.json({ error: "No hay clientes para importar" }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;

  for (const client of clients) {
    if (!client.name || !client.name.trim()) {
      skipped++;
      continue;
    }

    // Check if already exists by email WITHIN THIS TENANT
    if (client.email) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("email", client.email.trim())
        .eq("tenant_id", targetTenantId)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }
    }

    await supabase.from("clients").insert({
      name: client.name.trim(),
      email: client.email?.trim() || null,
      phone: client.phone?.trim() || null,
      notes: client.notes?.trim() || null,
      tenant_id: targetTenantId,
    });
    imported++;
  }

  return NextResponse.json({ success: true, imported, skipped, total: clients.length });
}
