import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, isManagerLevel } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { planillaMonthStart } from "@/lib/planilla-month";
import { leerCodigoPlanilla, resumenLineas } from "@/lib/planilla-codigo";

// Aprobar un descuento por planilla con su CODIGO (recepcion o administrador). Recien aqui se
// descuenta el stock y se anota en el libro del profesional (tipo "Descuento por planilla").
// Si el descuento supera el 15% (trabajadores con contrato), hace falta confirmarlo (`confirmOver`).
export async function POST(req: NextRequest) {
  const { ok, tenantId, userId } = await isManagerLevel();
  if (!ok || !tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({} as any));
  // Acepta el codigo corto (4 caracteres; los antiguos de 6 tambien) o el largo de la pistola («PL-…»).
  const leido = leerCodigoPlanilla(String(body?.scanCode || body?.code || ""));
  if (!leido) return NextResponse.json({ error: "Código no válido: son 4 caracteres, o el código largo que empieza con PL-." }, { status: 400 });

  const supabase = createAdminSupabase();
  const { data: d } = await supabase.from("payroll_discounts").select("*")
    .eq("tenant_id", tenantId).eq(leido.tipo === "escaneo" ? "scan_code" : "code", leido.code).eq("status", "pending").maybeSingle();
  if (!d) return NextResponse.json({ error: "Código no encontrado o ya usado." }, { status: 404 });
  const code = d.code as string;
  // Productos del descuento (uno solo en los antiguos).
  const lines: Array<{ product_id: string; product_name: string; quantity: number }> = Array.isArray(d.items) && d.items.length
    ? d.items : [{ product_id: d.product_id, product_name: d.product_name, quantity: d.quantity }];

  if (d.over_limit && body?.confirmOver !== true) {
    return NextResponse.json({
      needsConfirm: true,
      message: `Este descuento supera el 15% de lo que lleva ganado ${d.barber_name} este mes. Por ley el descuento por planilla no puede pasar de ese tope. ¿Confirmas igual?`,
      total: Number(d.total), barberName: d.barber_name, productName: resumenLineas(lines), quantity: d.quantity,
    }, { status: 409 });
  }

  // Stock suficiente de TODOS los productos antes de tocar nada.
  const prods = new Map<string, { id: string; stock: number }>();
  for (const l of lines) {
    const { data: prod } = await supabase.from("products").select("id, stock").eq("id", l.product_id).eq("tenant_id", tenantId).maybeSingle();
    if (!prod || Number(prod.stock) < l.quantity) return NextResponse.json({ error: `Ya no hay stock suficiente de ${l.product_name}.` }, { status: 409 });
    prods.set(l.product_id, { id: prod.id, stock: Number(prod.stock) });
  }

  // Marcar aprobado primero (solo si seguia pendiente): evita que dos personas apliquen el mismo codigo.
  const { data: me } = await supabase.from("profiles").select("name").eq("id", userId).maybeSingle();
  const { data: claimed } = await supabase.from("payroll_discounts")
    .update({ status: "approved", approved_by_name: me?.name || null, approved_at: new Date().toISOString() })
    .eq("id", d.id).eq("status", "pending").select("id");
  if (!claimed || claimed.length === 0) return NextResponse.json({ error: "Código no encontrado o ya usado." }, { status: 409 });

  let movErr: { message: string } | null = null;
  for (const l of lines) {
    const prod = prods.get(l.product_id)!;
    await supabase.from("products").update({ stock: prod.stock - l.quantity }).eq("id", prod.id);
    // Movimiento de inventario (salida por uso). Se revisa el resultado: antes un fallo aqui pasaba sin avisar.
    const movement = {
      product_id: prod.id, type: "out_use", quantity: l.quantity, barber_id: d.barber_id, tenant_id: tenantId, status: "approved",
      notes: `Descuento por planilla - ${d.barber_name} (${code})`,
    };
    let e1 = (await supabase.from("inventory_movements").insert(movement)).error;
    if (e1) {
      console.error("planilla: no se pudo registrar el movimiento de inventario:", e1.message);
      // Reintento sin las columnas opcionales por si alguna no existe en esta base.
      const { barber_id, status, ...basic } = movement as any;
      e1 = (await supabase.from("inventory_movements").insert(basic)).error;
      if (e1) console.error("planilla: reintento del movimiento tambien fallo:", e1.message);
    }
    if (e1) movErr = e1;
  }
  // El descuento cuenta en el mes en que se PIDIO (no en el que se aprueba).
  const month = planillaMonthStart(d.created_at, todayInChile());
  const { error: ledgerErr } = await supabase.from("professional_ledger").insert({
    tenant_id: tenantId, barber_id: d.barber_id, month, kind: "payroll_discount", amount: Number(d.total), effect: -1,
    reason: `Planilla: ${resumenLineas(lines)} (código ${code})`,
    created_by: userId, created_by_name: me?.name || null,
  });
  if (ledgerErr) console.error("planilla: no se pudo anotar en el libro del profesional:", ledgerErr.message);
  // Aviso al profesional: se aprobó su descuento.
  await notify({
    tenantId, kind: "planilla_approved", userIds: [d.barber_id],
    title: "Se aprobó tu descuento por planilla", body: resumenLineas(lines), url: "/dashboard/mi-billetera", createdBy: userId,
  });
  return NextResponse.json({ success: true, total: Number(d.total), ledgerSaved: !ledgerErr, movementSaved: !movErr, movementError: movErr?.message || null, ledgerError: ledgerErr?.message || null });
}
