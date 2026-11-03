import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant, isManagerLevel } from "@/lib/supabase/server";
import { computeProMonths } from "@/lib/ledger";
import { todayInChile } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { makeShortCode, makeScanCode, resumenLineas, type LineaPlanilla } from "@/lib/planilla-codigo";

// Descuento por planilla: el profesional elige un producto y se genera un CODIGO. Recien cuando
// recepcion o el administrador lo ingresa (ver ./aprobar) se descuenta el stock y se anota en el
// libro del profesional. Aqui: crear el codigo (cualquiera con sesion del negocio, p. ej. la tablet
// de Standby) y ver / rechazar los pendientes (administracion y recepcion).

const LIMIT_PCT = 15;

export async function POST(req: NextRequest) {
  const { userId, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId || !tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  // Varios productos en un solo codigo: items = [{ productId, quantity }]. (Sigue aceptando productId + quantity de un solo producto.)
  const raw: any[] = Array.isArray(body?.items) && body.items.length ? body.items : [{ productId: body?.productId, quantity: body?.quantity }];
  if (!body?.barberId || raw.length > 20) return NextResponse.json({ error: "Revisa el producto y la cantidad." }, { status: 400 });
  const wanted = new Map<string, number>();
  for (const it of raw) {
    const q = Math.floor(Number(it?.quantity) || 1);
    if (typeof it?.productId !== "string" || !it.productId || q < 1 || q > 50) return NextResponse.json({ error: "Revisa el producto y la cantidad." }, { status: 400 });
    wanted.set(it.productId, Math.min(50, (wanted.get(it.productId) || 0) + q));
  }

  const supabase = createAdminSupabase();
  const { data: pro } = await supabase.from("profiles")
    .select("id, name, work_mode, has_labor_contract").eq("id", body.barberId).eq("tenant_id", tenantId).eq("active", true).maybeSingle();
  if (!pro) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });

  const lines: LineaPlanilla[] = [];
  for (const [productId, quantity] of Array.from(wanted.entries())) {
    const { data: prod } = await supabase.from("products")
      .select("id, name, price, stock, product_type").eq("id", productId).eq("tenant_id", tenantId).eq("active", true).maybeSingle();
    if (!prod || ((prod as any).product_type || "sale") === "supply") return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    if (Number(prod.stock) < quantity) return NextResponse.json({ error: `De ${prod.name} solo quedan ${prod.stock} en stock.` }, { status: 409 });
    const unit = Math.round(Number(prod.price));
    lines.push({ product_id: prod.id, product_name: prod.name, quantity, unit_price: unit, total: unit * quantity });
  }
  const total = lines.reduce((t, l) => t + l.total, 0);
  const totalQty = lines.reduce((t, l) => t + l.quantity, 0);
  const headerName = lines.length > 1 ? `${lines[0].product_name} +${lines.length - 1} más` : lines[0].product_name;

  // Aviso del tope de 15%: solo trabajadores con contrato. Se compara contra lo que lleva ganado el
  // profesional este mes (comision sobre servicios) mas los descuentos ya aprobados del mes.
  let overLimit = false;
  if ((pro as any).has_labor_contract) {
    try {
      const [y, m] = todayInChile().split("-").map(Number);
      const mode = pro.work_mode === "rental" ? "rental" : "commission";
      const months = await computeProMonths(supabase, { tenantId, mode, year: y, month: m });
      const mine = months.find((x) => x.barberId === pro.id);
      const gross = Math.max(0, mine?.base || 0);
      const first = `${y}-${String(m).padStart(2, "0")}-01`;
      const { data: done } = await supabase.from("payroll_discounts").select("total")
        .eq("tenant_id", tenantId).eq("barber_id", pro.id).eq("status", "approved").gte("approved_at", first);
      const already = (done || []).reduce((s: number, r: any) => s + Number(r.total), 0);
      overLimit = gross <= 0 ? true : (already + total) > (gross * LIMIT_PCT) / 100;
    } catch {
      overLimit = true; // si no se puede calcular, mejor avisar que dejar pasar sin mirar
    }
  }

  const base = {
    tenant_id: tenantId, barber_id: pro.id, barber_name: pro.name, product_id: lines[0].product_id, product_name: headerName,
    quantity: totalQty, unit_price: lines[0].unit_price, total, over_limit: overLimit,
  };
  for (let i = 0; i < 8; i++) {
    const code = makeShortCode();
    const scanCode = makeScanCode();
    let { data, error } = await supabase.from("payroll_discounts").insert({ ...base, code, scan_code: scanCode, items: lines }).select("id, code, scan_code").single();
    // Sin la migracion 128: solo se puede un producto y sin codigo de pistola (codigo corto de 6 como antes).
    if (error && /items|scan_code/.test(error.message)) {
      if (lines.length > 1) return NextResponse.json({ error: "Falta aplicar la migración 128 para usar varios productos en un código." }, { status: 409 });
      ({ data, error } = await supabase.from("payroll_discounts").insert({ ...base, code: code + scanCode.slice(3, 5) }).select("id, code").single());
    }
    if (!error && data) {
      // Aviso a recepcion y administracion: hay un descuento por planilla por aprobar (sin montos en la pantalla bloqueada).
      await notify({
        tenantId, kind: "planilla_created", roles: ["admin", "receptionist"],
        title: "Descuento por planilla por aprobar", body: `${pro.name}: ${resumenLineas(lines)}`, url: "/dashboard/caja", createdBy: userId,
      });
      return NextResponse.json({ success: true, code: data.code, scanCode: (data as any).scan_code || null, total, overLimit, items: lines });
    }
    if (error && !/duplicate|unique/i.test(error.message)) {
      return NextResponse.json({ error: "Falta aplicar la migración 094 en la base de datos." }, { status: 409 });
    }
  }
  return NextResponse.json({ error: "No se pudo generar el código. Intenta de nuevo." }, { status: 500 });
}

export async function GET() {
  const { ok, tenantId } = await isManagerLevel();
  if (!ok || !tenantId) return NextResponse.json({ pending: [] });
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from("payroll_discounts")
    .select("id, barber_name, product_name, quantity, total, over_limit, created_at, code")
    .eq("tenant_id", tenantId).eq("status", "pending").order("created_at", { ascending: false }).limit(50);
  return NextResponse.json({ pending: error ? [] : data || [] });
}

// Rechazar un pendiente.
export async function PATCH(req: NextRequest) {
  const { ok, tenantId, userId } = await isManagerLevel();
  if (!ok || !tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({} as any));
  if (!body?.id) return NextResponse.json({ error: "Falta el descuento" }, { status: 400 });
  const supabase = createAdminSupabase();
  const { data: me } = await supabase.from("profiles").select("name").eq("id", userId).maybeSingle();
  const { data, error } = await supabase.from("payroll_discounts")
    .update({ status: "rejected", approved_by_name: me?.name || null, approved_at: new Date().toISOString() })
    .eq("id", body.id).eq("tenant_id", tenantId).eq("status", "pending").select("id");
  if (error || !data || data.length === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ success: true });
}
