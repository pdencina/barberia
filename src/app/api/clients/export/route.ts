import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";

export async function GET() {
  const admin = createAdminSupabase();

  // Authenticate the caller and enforce role + tenant scope. Exporting the full client
  // list is a sensitive bulk operation: barbers/clients must never be able to do it, and
  // the export must be scoped to the caller's own tenant (no cross-tenant leak).
  const authClient = createServerSupabase();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (!role || !["admin", "super_admin", "receptionist"].includes(role)) {
    return new NextResponse("No tienes permisos para exportar clientes", { status: 403 });
  }

  let query = admin
    .from("clients")
    .select("name, email, phone, notes, loyalty_points, created_at")
    .order("name");

  // Non super_admin is scoped to their own tenant.
  if (role !== "super_admin") {
    if (!profile?.tenant_id) {
      return new NextResponse("Sin negocio asignado", { status: 403 });
    }
    query = query.eq("tenant_id", profile.tenant_id);
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
