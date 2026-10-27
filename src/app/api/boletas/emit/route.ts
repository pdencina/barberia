import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, isManagerLevel } from "@/lib/supabase/server";
import { emitForTransaction } from "@/lib/sii-emit";

export const dynamic = "force-dynamic";

// POST: emite la boleta electrónica de una venta con la cuenta SII del negocio (botón manual / reintento).
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  // SEGURIDAD: solo la gestión del negocio de esa venta (super_admin: cualquiera).
  const me = await isManagerLevel();
  if (!me.userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!me.ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { transactionId } = await req.json().catch(() => ({}));
  if (!transactionId) return NextResponse.json({ error: "transactionId requerido" }, { status: 400 });

  const { data: owner } = await supabase.from("transactions").select("tenant_id").eq("id", transactionId).maybeSingle();
  const tenantId = (owner as any)?.tenant_id as string | undefined;
  if (!tenantId || (me.role !== "super_admin" && tenantId !== me.tenantId)) {
    return NextResponse.json({ error: "Transaccion no encontrada" }, { status: 404 });
  }

  const r = await emitForTransaction(supabase, tenantId, transactionId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 500 });
  return NextResponse.json({ success: true, folio: r.folio, pdfUrl: r.pdfUrl, environment: r.environment });
}
