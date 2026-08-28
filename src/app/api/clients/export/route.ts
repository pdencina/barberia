import { NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";

export async function GET() {
  const admin = createAdminSupabase();

  // Exporting the full client list is sensitive: only admin/super_admin, scoped to the
  // caller's own tenant (no cross-tenant leak). Never barbers or receptionists.
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  if (!role || !["admin", "super_admin"].includes(role)) {
    return new NextResponse("No tienes permisos para exportar clientes", { status: 403 });
  }

  let query = admin
    .from("clients")
    .select("name, email, phone, notes, loyalty_points, created_at")
    .order("name");

  // Non super_admin is scoped to their own tenant.
  if (role !== "super_admin") {
    if (!tenantId) {
      return new NextResponse("Sin negocio asignado", { status: 403 });
    }
    query = query.eq("tenant_id", tenantId);
  }

  const { data: clients } = await query;

  if (!clients || clients.length === 0) {
    return new NextResponse("Sin clientes", { status: 404 });
  }

  // Build CSV
  const headers = "Nombre,Email,Telefono,Notas,Puntos Fidelidad,Fecha Registro";
  const rows = clients.map((c) =>
    `"${c.name}","${c.email || ""}","${c.phone || ""}","${(c.notes || "").replace(/"/g, '""')}",${c.loyalty_points || 0},"${new Date(c.created_at).toLocaleDateString("es-CL")}"`
  );

  const csv = [headers, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-rebooking-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
