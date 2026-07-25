import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminSupabase();

  const { data: clients } = await supabase
    .from("clients")
    .select("name, email, phone, notes, loyalty_points, created_at")
    .order("name");

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
      "Content-Disposition": `attachment; filename="clientes-estudiolevels-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
