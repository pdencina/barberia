import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, authorizeBarberManagement } from "@/lib/supabase/server";
import { todayInChile, dateStrOffset, chileDayBoundsUtc } from "@/lib/utils";
import { isLedgerEnabled } from "@/lib/ledger";
import { splitProductSales } from "@/lib/product-split";

const paymentMethodLabels: Record<string, string> = {
  cash: "Efectivo",
  debit_card: "Debito",
  credit_card: "Credito",
  transfer: "Transferencia",
  mixed: "Mixto",
};

// GET: Get wallet data for a professional
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) return NextResponse.json({ error: "barberId required" }, { status: 400 });

  // SEGURIDAD: antes no pedia sesion y devolvia ganancias, comisiones y movimientos de cualquier profesional.
  // Ahora: el propio profesional, o admin/recepcion del mismo negocio (super_admin con cualquiera).
  const access = await authorizeBarberManagement(barberId, { allowSelf: true });
  if (!access.ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  // Get barber info
  const { data: barber } = await supabase
    .from("profiles")
    .select("id, name, work_mode, commission_rate, rental_daily_rate, tenant_id")
    .eq("id", barberId)
    .single();

  if (!barber) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });

  // Con el libro encendido, lo que ve el profesional es lo que se le paga: los productos no suman a su comision (solo los cosmeticos, $2.000 c/u).
  const ledgerOn = await isLedgerEnabled(supabase, (barber as any).tenant_id || null).catch(() => false);
  const comisionDe = async (rows: Array<{ id?: string; total: any }>, rate: number): Promise<number> => {
    const total = rows.reduce((s, t) => s + Number(t.total), 0);
    if (!ledgerOn) return Math.round(total * (rate / 100));
    const ids = rows.map((t) => t.id).filter(Boolean) as string[];
    const split = await splitProductSales(supabase, ids, (barber as any).tenant_id).catch(() => new Map());
    const esComision = (barber as any).work_mode !== "rental"; // los de arriendo no ganan comisión por cosméticos
    let servicios = 0, cosmeticos = 0;
    for (const t of rows) { const sp = t.id ? split.get(t.id) : undefined; servicios += Math.max(0, Number(t.total) - (sp?.productTotal || 0)); cosmeticos += esComision ? sp?.commission || 0 : 0; }
    return Math.round(servicios * (rate / 100)) + cosmeticos;
  };

  // Punto 1 (fix de arrastre, detectado al hacer el punto 16): esta ruta seguia usando
  // `new Date().toISOString().split("T")[0]` y limites naive "T00:00:00"/"T23:59:59"
  // (sin offset) para columnas timestamptz — el mismo patron ya corregido en el resto
  // del sistema, que aca se habia quedado sin tocar. Usa los helpers de Chile como
  // todo lo demas.
  const todayStr = todayInChile();
  const [chileYear, chileMonth] = todayStr.split("-").map(Number);
  const firstOfMonth = `${chileYear}-${String(chileMonth).padStart(2, "0")}-01`;
  const daysInMonth = new Date(Date.UTC(chileYear, chileMonth, 0)).getUTCDate();
  const lastOfMonthStr = `${chileYear}-${String(chileMonth).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const monthStartUtc = chileDayBoundsUtc(firstOfMonth).startUtc;
  const monthEndUtc = chileDayBoundsUtc(lastOfMonthStr).endUtc; // exclusive upper bound
  const todayBounds = chileDayBoundsUtc(todayStr);

  // Earnings this month (completed transactions)
  const { data: monthTx } = await supabase
    .from("transactions")
    .select("id, total, created_at, tip_amount")
    .eq("barber_id", barberId)
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", monthStartUtc)
    .lt("created_at", monthEndUtc);

  const totalSales = (monthTx || []).reduce((s, t) => s + Number(t.total), 0);
  // Propinas: van 100% al profesional que atendió.
  const monthTips = (monthTx || []).reduce((s, t: any) => s + (Number(t.tip_amount) || 0), 0);

  // Calculate earnings based on mode
  let earned = 0;
  let mode = barber.work_mode || "commission";

  if (mode === "commission") {
    const rate = barber.commission_rate || 40;
    earned = await comisionDe(monthTx || [], rate);
  } else {
    // Rental: earnings = sales (they keep all), minus rental fee (deducted separately
    // at monthly close).
    earned = totalSales;
  }

  // Today's earnings
  const { data: todayTx } = await supabase
    .from("transactions")
    .select("id, total, tip_amount")
    .eq("barber_id", barberId)
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", todayBounds.startUtc)
    .lt("created_at", todayBounds.endUtc);

  const todayEarnings = (todayTx || []).reduce((s, t) => s + Number(t.total), 0);
  const todayTips = (todayTx || []).reduce((s, t: any) => s + (Number(t.tip_amount) || 0), 0);
  const todayCommission = mode === "commission" ? await comisionDe(todayTx || [], barber.commission_rate || 40) : todayEarnings;

  // Projected: based on upcoming scheduled appointments
  const { data: upcomingAppts } = await supabase
    .from("appointments")
    .select("id, services:appointment_services(price)")
    .eq("barber_id", barberId)
    .in("status", ["scheduled", "confirmed"])
    .gte("date", todayStr)
    .lte("date", lastOfMonthStr);

  let projectedFromAppts = 0;
  for (const appt of upcomingAppts || []) {
    const apptTotal = ((appt as any).services || []).reduce((s: number, sv: any) => s + Number(sv.price || 0), 0);
    projectedFromAppts += apptTotal;
  }

  const projectedCommission = mode === "commission"
    ? Math.round(projectedFromAppts * ((barber.commission_rate || 40) / 100))
    : projectedFromAppts;

  const projected = earned + projectedCommission;

  // Daily breakdown (last 7 days)
  const dailyEarnings: Array<{ day: string; amount: number }> = [];
  const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  for (let i = 6; i >= 0; i--) {
    const dayStr = dateStrOffset(todayStr, -i);
    const dayBounds = chileDayBoundsUtc(dayStr);

    const { data: dayTx } = await supabase
      .from("transactions")
      .select("id, total")
      .eq("barber_id", barberId)
      .eq("type", "income")
      .eq("status", "completed")
      .gte("created_at", dayBounds.startUtc)
      .lt("created_at", dayBounds.endUtc);

    const dayTotal = (dayTx || []).reduce((s, t) => s + Number(t.total), 0);
    const dayCommission = mode === "commission" ? await comisionDe(dayTx || [], barber.commission_rate || 40) : dayTotal;

    // Weekday from the noon-UTC instant of that calendar date, so it never shifts off
    // by a day regardless of the server's own timezone.
    const weekday = new Date(`${dayStr}T12:00:00Z`).getUTCDay();
    dailyEarnings.push({ day: dayNames[weekday], amount: dayCommission });
  }

  // Transaction count
  const txCount = monthTx?.length || 0;

  // Punto 16 (Pablo): detalle diario de movimientos, con selector de fecha/rango en el
  // frontend. Por defecto (sin from/to) trae el dia de hoy en Chile.
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const fromStr = fromParam && dateRe.test(fromParam) ? fromParam : todayStr;
  const toStr = toParam && dateRe.test(toParam) ? toParam : fromStr;
  const rangeStartUtc = chileDayBoundsUtc(fromStr).startUtc;
  const rangeEndUtc = chileDayBoundsUtc(toStr).endUtc; // exclusive upper bound

  const { data: movementsRaw } = await supabase
    .from("transactions")
    .select("id, total, payment_method, created_at, tip_amount, client:clients(name), items:transaction_items(description, quantity, unit_price)")
    .eq("barber_id", barberId)
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", rangeStartUtc)
    .lt("created_at", rangeEndUtc)
    .order("created_at", { ascending: false });

  // Amounts here are the full sale (client's total), not the professional's commission
  // cut — the daily/month cards above already show the commission-adjusted figures;
  // this detail list is "lo generado" per Pablo's wording (the underlying sales), same
  // as Finanzas shows for any other transaction.
  // Ventas pagadas con mas de un medio: se muestra cuanto fue con cada uno.
  const mixtas = (movementsRaw || []).filter((t: any) => t.payment_method === "mixed").map((t: any) => t.id as string);
  const pagosMixtos = new Map<string, { label: string; amount: number }[]>();
  if (mixtas.length) {
    for (let i = 0; i < mixtas.length; i += 150) {
      const { data: pg } = await supabase.from("transaction_payments").select("transaction_id, payment_method, amount").in("transaction_id", mixtas.slice(i, i + 150));
      for (const r of (pg as any[]) || []) {
        const l = pagosMixtos.get(r.transaction_id) || [];
        l.push({ label: paymentMethodLabels[r.payment_method] || r.payment_method, amount: Number(r.amount) || 0 });
        pagosMixtos.set(r.transaction_id, l);
      }
    }
  }
  const movements = (movementsRaw || []).map((t: any) => ({
    id: t.id,
    createdAt: t.created_at,
    clientName: t.client?.name || "Cliente",
    service: (t.items || []).map((i: any) => i.description).filter(Boolean).join(", ") || "-",
    amount: Number(t.total),
    paymentMethod: t.payment_method,
    paymentMethodLabel: paymentMethodLabels[t.payment_method] || t.payment_method,
    tip: Number(t.tip_amount) || 0,
    payments: pagosMixtos.get(t.id) || [],
    items: (t.items || []).filter((i: any) => i.description).map((i: any) => ({ name: i.description as string, quantity: Number(i.quantity) || 1, total: (Number(i.quantity) || 1) * (Number(i.unit_price) || 0) })),
  }));

  return NextResponse.json({
    barber: { name: barber.name, mode, commissionRate: barber.commission_rate, rentalRate: barber.rental_daily_rate },
    month: {
      earned,
      totalSales,
      projected,
      projectedFromAppts: projectedCommission,
      txCount,
      tips: monthTips,
      upcomingAppts: upcomingAppts?.length || 0,
    },
    today: { earnings: todayCommission, sales: todayEarnings, tips: todayTips },
    dailyEarnings,
    movements,
    movementsRange: { from: fromStr, to: toStr },
  });
}
