import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCallerForView } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/utils";
import { accountingColumnsAvailable, isMonthClosed, monthLabelEs, monthStart } from "@/lib/accounting";
import { validarMovimientoNegocio } from "@/lib/oti/negocio";

export const dynamic = "force-dynamic";

// Oti (administrador): anota un gasto o ingreso en Ingresos/Egresos del NEGOCIO. Solo administrador; el negocio sale de la sesión
// (nunca del navegador); respeta el cierre mensual. Es el mismo movimiento que se crea a mano en Finanzas (asignado a «Negocio general»).
export async function POST(req: NextRequest) {
  const c = await getCallerForView();
  if (!c.userId || (c.role !== "admin" && c.role !== "super_admin")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!c.tenantId || c.tenantId === "ALL") return NextResponse.json({ error: "Elige primero un negocio" }, { status: 400 });
  const v = validarMovimientoNegocio(await req.json().catch(() => ({})), todayInChile());
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const m = v.value;

  const supabase = createAdminSupabase();
  const acc = await accountingColumnsAvailable(supabase);
  const mes = monthStart(m.fecha.slice(0, 7)) || monthStart(todayInChile().slice(0, 7));
  if (acc && mes && (await isMonthClosed(supabase, c.tenantId, mes))) {
    return NextResponse.json({ error: `El mes de ${monthLabelEs(mes)} está cerrado. Reábrelo en Cierre mensual para registrar este movimiento.` }, { status: 409 });
  }
  const base: Record<string, unknown> = {
    type: m.tipo === "gasto" ? "expense" : "income", status: "completed", subtotal: m.monto, total: m.monto,
    payment_method: m.medio, notes: "Anotado con Oti", tenant_id: c.tenantId, assigned_to: "business", barber_id: null,
  };
  const { data: tx, error } = await supabase.from("transactions").insert(acc ? { ...base, accounting_month: mes, created_by: c.userId } : base).select("id").single();
  if (error || !tx) return NextResponse.json({ error: "No pude guardar el movimiento" }, { status: 500 });
  await supabase.from("transaction_items").insert({ transaction_id: tx.id, description: m.descripcion, quantity: 1, unit_price: m.monto, total: m.monto });
  return NextResponse.json({ success: true, id: tx.id }, { status: 201 });
}
