import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, isManagerLevel, resolveTenantForRequest } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/utils";
import type { ProMode } from "@/lib/ledger";
import { computeProSalesDetail } from "@/lib/pro-sales-detail";

export const dynamic = "force-dynamic";

// Detalle de TODAS las ventas del mes de cada profesional: de donde sale lo que se le paga (servicios, productos, propinas).
// Solo lectura. Admin y recepcion, y solo del negocio de la sesion (nunca de un tenantId del navegador).
export async function GET(req: NextRequest) {
  const { ok } = await isManagerLevel();
  if (!ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const { tenantId, denied } = await resolveTenantForRequest(searchParams.get("tenantId"));
  if (denied || !tenantId || tenantId === "ALL") return NextResponse.json({ error: "Elige un negocio" }, { status: 400 });

  const mode: ProMode = searchParams.get("mode") === "rental" ? "rental" : "commission";
  const [cy, cm] = todayInChile().split("-").map(Number);
  const month = Math.min(12, Math.max(1, parseInt(searchParams.get("month") || String(cm)) || cm));
  const year = parseInt(searchParams.get("year") || String(cy)) || cy;
  try {
    const pros = await computeProSalesDetail(supabase, { tenantId, mode, year, month });
    return NextResponse.json({ period: { month, year }, mode, pros });
  } catch { return NextResponse.json({ error: "No pude leer las ventas" }, { status: 500 }); }
}
