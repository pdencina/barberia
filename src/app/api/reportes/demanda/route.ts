import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";
import { dateStrOffset, todayInChile } from "@/lib/utils";
import { construirMapa } from "@/lib/demand-map";

export const dynamic = "force-dynamic";

// Mapa de demanda del negocio (solo admin): reservas promedio por semana en cada dia y hora. Solo lectura.
// El negocio sale siempre de la sesion; un administrador no puede pedir el de otro.
export async function GET(req: NextRequest) {
  const c = await getCurrentUserRoleAndTenant();
  if (!c.userId || (c.role !== "admin" && c.role !== "super_admin") || !c.tenantId || c.tenantId === "ALL") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const sp = new URL(req.url).searchParams;
  const weeks = [4, 8, 12].includes(Number(sp.get("weeks"))) ? Number(sp.get("weeks")) : 8;
  const hasta = dateStrOffset(todayInChile(), -1); // semanas completas hacia atras, sin contar hoy
  const desde = dateStrOffset(hasta, -(weeks * 7) + 1);
  const barberId = sp.get("barberId");
  if (barberId && !/^[0-9a-f-]{36}$/i.test(barberId)) return NextResponse.json({ error: "Profesional no valido" }, { status: 400 });

  const supabase = createAdminSupabase();
  try {
    const rows = await fetchAllRows<any>(() => {
      let q = supabase.from("appointments").select("id, date, start_time, end_time, status").eq("tenant_id", c.tenantId!).gte("date", desde).lte("date", hasta);
      if (barberId) q = q.eq("barber_id", barberId);
      return q;
    });
    return NextResponse.json(construirMapa(rows, weeks, desde, hasta));
  } catch {
    return NextResponse.json({ error: "No se pudo calcular el mapa de demanda" }, { status: 500 });
  }
}
