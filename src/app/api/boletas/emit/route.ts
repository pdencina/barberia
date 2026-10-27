import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, isManagerLevel } from "@/lib/supabase/server";
import { emitForTransaction } from "@/lib/sii-emit";

export const dynamic = "force-dynamic";

// POST: emite la boleta electrónica de una venta con la cuenta SII del negocio (botón manual / reintento).
export async function POST(req: NextRequest) {
  // SEGURIDAD: antes esta ruta no pedía sesión ni revisaba el negocio de la venta.
  const { ok, tenantId } = await isManagerLevel();
  if (!ok || !tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { transactionId } = await req.json().catch(() => ({}));
  if (!transactionId) return NextResponse.json({ error: "transactionId requerido" }, { status: 400 });

  const r = await emitForTransaction(createAdminSupabase(), tenantId, transactionId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 500 });
  return NextResponse.json({ success: true, folio: r.folio, pdfUrl: r.pdfUrl, environment: r.environment });
}
