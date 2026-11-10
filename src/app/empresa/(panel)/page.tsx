"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Boxes, ClipboardList, Eye, EyeOff, Package, PiggyBank, Receipt, Wallet } from "lucide-react";
import { useCan } from "@/components/empresa/shell";
import { Message, useApi } from "@/components/empresa/ui";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Panel, PageHeader, Segmented, StatCard, tableStyles } from "@/components/ui/premium";
import { NO_BRAND, PERIOD_LABEL, type Dashboard, type Period } from "@/lib/empresas/dashboard";
import { formatCurrency } from "@/lib/utils";

const corto = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1).replace(".", ",")} MM` : Math.abs(n) >= 1e3 ? `$${Math.round(n / 1e3)} mil` : `$${n}`);
const OCULTO = "$ ••••••";
// Montos de 10 millones o más se muestran abreviados ($12,3 MM) para que quepan en la tarjeta.
const grande = (n: number) => (Math.abs(n) >= 1e7 ? corto(n) : formatCurrency(n));

// Dashboard del dueño: cómo rinden sus marcas. Los demás roles entran directo a Stock.
export default function EmpresaDashboardPage() {
  const can = useCan();
  const router = useRouter();
  const owner = can("reporte.ver");
  useEffect(() => { if (!owner) router.replace("/empresa/stock"); }, [owner, router]);
  return owner ? <DashboardDueno /> : null;
}

function DashboardDueno() {
  const [period, setPeriod] = useState<Period>("month");
  const [brand, setBrand] = useState<string>("");
  const [hide, setHide] = useState(false);
  const { data, error } = useApi<Dashboard & { allBrands: { id: string; name: string; color: string }[] }>(
    `dashboard?period=${period}${brand ? `&brand=${brand}` : ""}`,
  );
  const money = (n: number) => (hide ? OCULTO : formatCurrency(n));
  const t = data?.totals;

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Rendimiento de tus marcas"
        subtitle={data ? `${PERIOD_LABEL[period]} · ventas despachadas` : "Cargando..."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented size="sm" value={period} onChange={(v) => setPeriod(v)}
              options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
          </div>
        }
      />

      {data && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <BrandChip active={!brand} color="#10201F" label="Todas las marcas" onClick={() => setBrand("")} />
          {data.allBrands.map((b) => <BrandChip key={b.id} active={brand === b.id} color={b.color} label={b.name} onClick={() => setBrand(b.id)} />)}
          <Link href="/empresa/marcas" className="whitespace-nowrap rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:border-brand-blue hover:text-brand-blue">+ Nueva marca</Link>
        </div>
      )}

      <Message error={error} />
      {!data && !error && <p className="text-sm text-gray-500">Cargando...</p>}

      {data && t && (
        <>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
            <StatCard compact hero className="col-span-2 lg:col-span-1"
              label="Ventas"
              labelAction={
                <button type="button" onClick={() => setHide(!hide)} title={hide ? "Mostrar montos" : "Ocultar montos"} className="rounded-full p-1 text-white/80 hover:bg-white/20 hover:text-white">
                  {hide ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              value={hide ? OCULTO : <AnimatedNumber value={t.revenue} format={grande} />}
              Icon={Wallet}
              delta={{ value: t.revenueChange, suffix: "vs período anterior" }}
              footnote={t.pendingOrders > 0 ? `Por despachar: ${hide ? "••••" : corto(t.pendingValue)}` : undefined}
            />
            <StatCard compact label="Margen bruto" Icon={PiggyBank} tone="green"
              value={hide ? OCULTO : <AnimatedNumber value={t.margin} format={grande} />}
              delta={{ value: t.marginChange, suffix: t.marginPct === null ? "" : `· ${t.marginPct}% de margen` }} />
            <StatCard compact label="Unidades vendidas" Icon={Package} tone="violet"
              value={<AnimatedNumber value={t.units} />} delta={{ value: t.unitsChange }} />
            <StatCard compact label="Pedidos" Icon={Receipt} tone="amber"
              value={<AnimatedNumber value={t.orders} />} delta={{ value: t.ordersChange, suffix: `· ticket ${hide ? "••••" : corto(t.avgTicket)}` }} />
            <StatCard compact label="Stock valorizado" Icon={Boxes} tone="slate"
              value={hide ? OCULTO : <AnimatedNumber value={t.stockAtCost} format={grande} />}
              hint={`${t.stockUnits.toLocaleString("es-CL")} unidades · ${t.lowStock} bajo mínimo`} />
          </div>

          <Panel title="Rentabilidad por marca" subtitle="Ventas, margen y participación en el período">
            <div className="space-y-3">
              {data.brands.length === 0 && <p className="text-sm text-gray-500">Todavía no hay marcas. <Link href="/empresa/marcas" className="text-brand-blue underline">Crea la primera</Link>.</p>}
              {data.brands.map((b) => (
                <button key={b.id} type="button" onClick={() => setBrand(brand === b.id ? "" : b.id)} className="block w-full rounded-xl p-2 text-left hover:bg-gray-50">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="flex items-center gap-2 font-semibold text-brand-dark">
                      <span className="h-3 w-3 rounded-full" style={{ background: b.color }} />{b.name}
                    </span>
                    <span className="text-sm tabular-nums text-brand-dark">
                      {money(b.revenue)}
                      <span className={`ml-2 text-xs font-semibold ${b.revenueChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>{b.revenueChange >= 0 ? "▲" : "▼"} {Math.abs(b.revenueChange)}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, b.share)}%`, background: b.color }} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">
                    <span>{b.share}% de las ventas</span>
                    <span>Margen {hide ? "••••" : formatCurrency(b.margin)}{b.marginPct !== null ? ` (${b.marginPct}%)` : ""}</span>
                    <span>{b.units.toLocaleString("es-CL")} unid.</span>
                    <span>{b.orders} pedidos · {b.customers} clientes</span>
                    <span>Stock {hide ? "••••" : corto(b.stockAtCost)}{b.lowStock ? ` · ${b.lowStock} bajo mínimo` : ""}</span>
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Ventas de los últimos 6 meses" subtitle="Por marca, a la fecha de despacho">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly.map((m) => ({ label: m.label, ...m.values }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#EEF0F0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6B7280" }} />
                  <YAxis tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11, fill: "#6B7280" }} tickFormatter={(v) => (hide ? "" : corto(Number(v)))} />
                  <Tooltip formatter={(v: any, key: any) => [hide ? OCULTO : formatCurrency(Number(v)), data.brands.find((b) => b.id === key)?.name || key]} cursor={{ fill: "rgba(10,110,107,0.06)" }} />
                  {data.brands.map((b) => <Bar key={b.id} dataKey={b.id} stackId="ventas" fill={b.color} radius={0} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Productos más vendidos" flush>
              <TopTable rows={data.topProducts.map((p) => ({ key: p.id, name: p.name, sub: `${p.brand}${p.sku ? ` · ${p.sku}` : ""}`, units: p.units, value: p.revenue, marginPct: p.marginPct }))} hide={hide} />
            </Panel>
            <Panel title="Mejores clientes" flush>
              <TopTable rows={data.topCustomers.map((c) => ({ key: c.id, name: c.name, sub: `${c.orders} pedidos`, units: c.units, value: c.revenue, marginPct: c.marginPct }))} hide={hide} />
            </Panel>
          </div>

          <p className="text-xs text-gray-500">
            Ventas = pedidos despachados o entregados, con el precio del pedido. Margen = venta − costo actual del producto
            (los productos sin costo no entran al margen). {brand === NO_BRAND ? "" : "Toca una marca para ver solo sus números."}
            {" "}<Link href="/empresa/pedidos" className="inline-flex items-center gap-1 text-brand-blue underline"><ClipboardList className="h-3 w-3" />Ver pedidos</Link>
          </p>
        </>
      )}
    </div>
  );
}

function BrandChip({ active, color, label, onClick }: { active: boolean; color: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-transparent text-white" : "border-gray-200 bg-white text-brand-dark hover:border-gray-300"}`}
      style={active ? { background: color } : undefined}>
      {!active && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}

function TopTable({ rows, hide }: { rows: { key: string; name: string; sub: string; units: number; value: number; marginPct: number | null }[]; hide: boolean }) {
  if (rows.length === 0) return <p className="p-4 text-sm text-gray-500">Sin ventas en el período.</p>;
  return (
    <div className={tableStyles.wrap}>
      <table className={tableStyles.table}>
        <thead className={tableStyles.thead}><tr>
          <th className={tableStyles.th}>Nombre</th><th className={tableStyles.thRight}>Unid.</th><th className={tableStyles.thRight}>Ventas</th><th className={tableStyles.thRight}>Margen</th>
        </tr></thead>
        <tbody className={tableStyles.tbody}>
          {rows.map((r) => (
            <tr key={r.key} className={tableStyles.tr}>
              <td className={tableStyles.td}><p className="font-medium text-brand-dark">{r.name}</p><p className="text-xs text-gray-500">{r.sub}</p></td>
              <td className={tableStyles.tdRight}>{r.units.toLocaleString("es-CL")}</td>
              <td className={tableStyles.tdRight}>{hide ? "••••" : formatCurrency(r.value)}</td>
              <td className={tableStyles.tdRight}>{r.marginPct === null ? "-" : `${r.marginPct}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
