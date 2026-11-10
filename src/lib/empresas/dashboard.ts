// Dashboard del dueño de una empresa: cómo rinde cada marca. Funciones puras (se prueban sin base de datos).
// Venta = pedido despachado o entregado, a la fecha de despacho, con el precio guardado en el pedido.
// Costo = costo ACTUAL del producto × unidades (el pedido no guarda el costo histórico). Sin costo, no entra al margen.

export type Period = "month" | "30d" | "quarter" | "year";
export const PERIOD_LABEL: Record<Period, string> = { month: "Este mes", "30d": "Últimos 30 días", quarter: "Últimos 3 meses", year: "Este año" };

const DAY = 86400e3;
const CL = 3 * 3600e3; // Chile (UTC-3); suficiente para cortes de día/mes en un resumen

/** Rango [from, to) del período y el período anterior equivalente (mismo largo, justo antes; o el mismo tramo del año pasado). */
export function periodRanges(period: Period, now: number) {
  const local = new Date(now - CL);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  let from: number;
  let prevFrom: number;
  let prevTo: number;
  if (period === "month") {
    from = Date.UTC(y, m, 1) + CL;
    prevFrom = Date.UTC(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 1) + CL;
    prevTo = Math.min(prevFrom + (now - from), from);
  } else if (period === "year") {
    from = Date.UTC(y, 0, 1) + CL;
    prevFrom = Date.UTC(y - 1, 0, 1) + CL;
    prevTo = prevFrom + (now - from);
  } else {
    const days = period === "30d" ? 30 : 90;
    from = now - days * DAY;
    prevFrom = from - days * DAY;
    prevTo = from;
  }
  return { from, to: now, prevFrom, prevTo };
}

/** Los últimos `n` meses calendario (Chile), del más antiguo al actual: clave "YYYY-MM", etiqueta y rango. */
export function lastMonths(now: number, n: number) {
  const local = new Date(now - CL);
  const out: { key: string; label: string; from: number; to: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - i, 1));
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    out.push({
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("es-CL", { month: "short", timeZone: "UTC" }).replace(".", ""),
      from: d.getTime() + CL,
      to: next.getTime() + CL,
    });
  }
  return out;
}

export type DashProduct = { id: string; name: string; sku: string | null; brandId: string | null; cost: number | null; listPrice: number | null; minStock: number; active: boolean };
export type DashBrand = { id: string; name: string; color: string; active: boolean };
export type DashOrder = { id: string; customerId: string; customerName: string; dispatchedAt: string; items: { productId: string; quantity: number; unitPrice: number | null }[] };
export type DashStock = { productId: string; quantity: number; reserved: number };

export const NO_BRAND = "sin-marca";

// Colores que se van asignando a las marcas nuevas si no se elige uno.
export const BRAND_COLORS = ["#0A6E6B", "#2563EB", "#D97706", "#7C3AED", "#DC2626", "#059669", "#DB2777", "#4B5563", "#0891B2", "#65A30D"];

type Acc = { revenue: number; cost: number; costedRevenue: number; units: number; orders: Set<string>; customers: Set<string> };
const acc = (): Acc => ({ revenue: 0, cost: 0, costedRevenue: 0, units: 0, orders: new Set(), customers: new Set() });

function add(a: Acc, o: DashOrder, line: DashOrder["items"][number], p: DashProduct | undefined) {
  const revenue = (line.unitPrice ?? 0) * line.quantity;
  a.revenue += revenue;
  a.units += line.quantity;
  a.orders.add(o.id);
  a.customers.add(o.customerId);
  if (p?.cost != null) {
    a.cost += p.cost * line.quantity;
    a.costedRevenue += revenue;
  }
}

const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur > 0 ? 100 : 0);
const marginPct = (a: Acc) => (a.costedRevenue > 0 ? Math.round(((a.costedRevenue - a.cost) / a.costedRevenue) * 1000) / 10 : null);
const summary = (a: Acc) => ({
  revenue: Math.round(a.revenue),
  margin: Math.round(a.costedRevenue - a.cost),
  marginPct: marginPct(a),
  units: a.units,
  orders: a.orders.size,
  customers: a.customers.size,
  avgTicket: a.orders.size ? Math.round(a.revenue / a.orders.size) : 0,
});

/**
 * Arma todo el dashboard. brandFilter: solo esa marca (o NO_BRAND), o null para todas.
 * Un pedido con productos de varias marcas cuenta como pedido en cada una de ellas.
 */
export function buildDashboard(args: {
  now: number; period: Period; brandFilter: string | null;
  brands: DashBrand[]; products: DashProduct[]; orders: DashOrder[]; stock: DashStock[]; pending: DashOrder[];
}) {
  const { now, period, brandFilter, brands, products, orders, stock, pending } = args;
  const r = periodRanges(period, now);
  const months = lastMonths(now, 6);
  const prod = new Map(products.map((p) => [p.id, p]));
  const brandOf = (productId: string) => prod.get(productId)?.brandId || NO_BRAND;
  const inFilter = (productId: string) => !brandFilter || brandOf(productId) === brandFilter;

  const cur = acc();
  const prev = acc();
  const byBrand = new Map<string, { cur: Acc; prev: Acc }>();
  const byProduct = new Map<string, Acc>();
  const byCustomer = new Map<string, { name: string; a: Acc }>();
  const series = new Map<string, Map<string, number>>(); // mes → marca → ventas

  for (const o of orders) {
    const t = Date.parse(o.dispatchedAt);
    const inCur = t >= r.from && t < r.to;
    const inPrev = t >= r.prevFrom && t < r.prevTo;
    const month = months.find((mm) => t >= mm.from && t < mm.to);
    for (const line of o.items) {
      if (!inFilter(line.productId)) continue;
      const p = prod.get(line.productId);
      const b = brandOf(line.productId);
      if (!byBrand.has(b)) byBrand.set(b, { cur: acc(), prev: acc() });
      if (inCur) {
        add(cur, o, line, p);
        add(byBrand.get(b)!.cur, o, line, p);
        if (!byProduct.has(line.productId)) byProduct.set(line.productId, acc());
        add(byProduct.get(line.productId)!, o, line, p);
        if (!byCustomer.has(o.customerId)) byCustomer.set(o.customerId, { name: o.customerName, a: acc() });
        add(byCustomer.get(o.customerId)!.a, o, line, p);
      }
      if (inPrev) {
        add(prev, o, line, p);
        add(byBrand.get(b)!.prev, o, line, p);
      }
      if (month) {
        if (!series.has(month.key)) series.set(month.key, new Map());
        const s = series.get(month.key)!;
        s.set(b, (s.get(b) || 0) + (line.unitPrice ?? 0) * line.quantity);
      }
    }
  }

  // Stock actual, valorizado a costo y a precio de lista.
  const stockByBrand = new Map<string, { units: number; atCost: number; atList: number; lowStock: number }>();
  const qtyByProduct = new Map<string, number>();
  for (const s of stock) qtyByProduct.set(s.productId, (qtyByProduct.get(s.productId) || 0) + s.quantity);
  for (const p of products) {
    if (!p.active || !inFilter(p.id)) continue;
    const b = p.brandId || NO_BRAND;
    const q = qtyByProduct.get(p.id) || 0;
    const e = stockByBrand.get(b) || { units: 0, atCost: 0, atList: 0, lowStock: 0 };
    e.units += q;
    e.atCost += (p.cost ?? 0) * q;
    e.atList += (p.listPrice ?? 0) * q;
    if (q < p.minStock) e.lowStock++;
    stockByBrand.set(b, e);
  }

  // Pedidos confirmados o preparados que todavía no salen: plata comprometida.
  let pendingValue = 0;
  const pendingOrders = new Set<string>();
  for (const o of pending) for (const line of o.items) {
    if (!inFilter(line.productId)) continue;
    pendingValue += (line.unitPrice ?? 0) * line.quantity;
    pendingOrders.add(o.id);
  }

  const brandIds = new Set<string>([...brands.filter((b) => b.active).map((b) => b.id), ...Array.from(byBrand.keys()), ...Array.from(stockByBrand.keys())]);
  // Marcas con ventas en el gráfico de 6 meses aunque no tengan en el período (para que el gráfico cuadre).
  series.forEach((m) => m.forEach((v, b) => { if (v > 0) brandIds.add(b); }));
  if (brandFilter) for (const id of Array.from(brandIds)) if (id !== brandFilter) brandIds.delete(id);
  const brandInfo = (id: string) => (id === NO_BRAND ? { id, name: "Sin marca", color: "#9CA3AF" } : brands.find((b) => b.id === id) ?? { id, name: "Marca inactiva", color: "#9CA3AF" });
  const totalRevenue = cur.revenue || 1;

  const brandRows = Array.from(brandIds).map((id) => {
    const e = byBrand.get(id) || { cur: acc(), prev: acc() };
    const s = stockByBrand.get(id) || { units: 0, atCost: 0, atList: 0, lowStock: 0 };
    const c = summary(e.cur);
    return {
      ...brandInfo(id), ...c,
      share: Math.round((e.cur.revenue / totalRevenue) * 1000) / 10,
      revenueChange: pct(e.cur.revenue, e.prev.revenue),
      stockUnits: s.units, stockAtCost: Math.round(s.atCost), stockAtList: Math.round(s.atList), lowStock: s.lowStock,
    };
  }).filter((b) => b.id !== NO_BRAND || b.revenue > 0 || b.stockUnits > 0 || Array.from(series.values()).some((m) => (m.get(NO_BRAND) || 0) > 0))
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));

  const totals = summary(cur);
  const prevTotals = summary(prev);
  const stockTotals = Array.from(stockByBrand.values()).reduce((t, s) => ({ units: t.units + s.units, atCost: t.atCost + s.atCost, atList: t.atList + s.atList, lowStock: t.lowStock + s.lowStock }), { units: 0, atCost: 0, atList: 0, lowStock: 0 });

  return {
    period, periodLabel: PERIOD_LABEL[period],
    range: { from: new Date(r.from).toISOString(), to: new Date(r.to).toISOString() },
    totals: {
      ...totals,
      revenueChange: pct(cur.revenue, prev.revenue),
      marginChange: pct(totals.margin, prevTotals.margin),
      unitsChange: pct(cur.units, prev.units),
      ordersChange: pct(totals.orders, prevTotals.orders),
      stockUnits: stockTotals.units, stockAtCost: Math.round(stockTotals.atCost), stockAtList: Math.round(stockTotals.atList), lowStock: stockTotals.lowStock,
      pendingValue: Math.round(pendingValue), pendingOrders: pendingOrders.size,
    },
    brands: brandRows,
    monthly: months.map((mm) => ({
      key: mm.key, label: mm.label,
      values: Object.fromEntries(brandRows.map((b) => [b.id, Math.round(series.get(mm.key)?.get(b.id) || 0)])),
    })),
    topProducts: Array.from(byProduct.entries()).map(([id, a]) => {
      const p = prod.get(id);
      return { id, name: p?.name || "Producto", sku: p?.sku ?? null, brand: brandInfo(p?.brandId || NO_BRAND).name, ...summary(a) };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    topCustomers: Array.from(byCustomer.entries()).map(([id, c]) => ({ id, name: c.name, ...summary(c.a) }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 8),
  };
}

export type Dashboard = ReturnType<typeof buildDashboard>;
