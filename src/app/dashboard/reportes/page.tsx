"use client";

import { ComparativaChart } from "@/components/dashboard/comparativa-chart";
import { useState, useEffect, useRef } from "react";
import { formatCurrency, todayInChile } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronLeft, ChevronRight, FileDown, Coins, Percent, KeyRound, TrendingDown, PiggyBank, Receipt, CalendarCheck, UserPlus,
} from "lucide-react";
import { PageHeader, StatCard, Panel, tableStyles as ts, primaryButton } from "@/components/ui/premium";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cacheKey, readCache, writeCache } from "@/lib/swr-cache";
import { MonthClosePanel } from "@/components/finance/month-close-panel";

interface ReportData {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    incomeCommission: number;
    incomeRental: number;
    salonNetIncome: number;
    totalTransactions: number;
    incomeCount?: number;
    expenseCount?: number;
    appointmentsCompleted: number;
    newClients: number;
  };
  incomeByBarber: Array<{ name: string; total: number; count: number; workMode: string }>;
  incomeByMethod: Array<{ method: string; total: number; count: number }>;
  topServices: Array<{ name: string; count: number; total: number; lista?: number; descuentos?: number }>;
  topProducts: Array<{ name: string; count: number; total: number; lista?: number; descuentos?: number }>;
  resumenCuadra?: { serviciosLista: number; descuentos: number; serviciosCobrado: number; productosCobrado: number; sinDetalle: number; totalIngresos: number; cuadra: boolean; diferencia: number; ventasAjustadas: number; ventasSinProfesional: number; montoSinProfesional: number; abonosAplicados?: number; cobradoEnElMes?: number; abonosRecibidos?: number };
  expensesDetail: Array<{ name: string; count: number; total: number }>;
}

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const paymentMethodLabels: Record<string, string> = {
  cash: "Efectivo",
  debit_card: "Debito",
  credit_card: "Credito",
  transfer: "Transferencia",
  abono: "Abonos (reservas pagadas)",
};

export default function ReportesPage() {
  const { user, isAtLeast } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const [chileYear, chileMonth] = todayInChile().split("-").map(Number);
  const [month, setMonth] = useState(chileMonth);
  const [year, setYear] = useState(chileYear);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<Array<{ label: string; income: number; expenses: number }>>([]);

  // Cache de lectura en memoria (por usuario, negocio y mes): al volver a la pantalla o a un mes ya visto se muestra al tiro
  // y las cifras se animan cuando llega lo actualizado. skipSpinnerRef lo activa solo la carga automatica, no "onChanged".
  const reportKey = cacheKey(["reportes-monthly", user?.id, tenant?.id, String(year), String(month)]);
  const skipSpinnerRef = useRef(false);
  const fetchReport = async () => {
    if (!skipSpinnerRef.current) setLoading(true);
    skipSpinnerRef.current = false;
    try {
      const res = await fetch(`/api/reportes/monthly?month=${month}&year=${year}`);
      const result = await res.json();
      if (result.summary) {
        setData(result);
        writeCache(reportKey, result, "memory");
      }
    } catch (err) {
      console.error("Error fetching report:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantLoading) return;
    const cached = readCache<ReportData>(reportKey, undefined, "memory");
    if (cached?.summary) { setData(cached); setLoading(false); skipSpinnerRef.current = true; }
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, tenantLoading, tenant?.id, user?.id]);

  useEffect(() => {
    if (tenantLoading) return;
    const ck = cacheKey(["reportes-comparison", user?.id, tenant?.id]);
    const cached = readCache<Array<{ label: string; income: number; expenses: number }>>(ck, undefined, "memory");
    if (cached) setComparison(cached);
    fetch("/api/reportes/comparison")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) { setComparison(d); writeCache(ck, d, "memory"); } else setComparison([]);
      });
  }, [tenantLoading, tenant?.id, user?.id]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <PageHeader title="Cierre mensual" />
        <Spinner />
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-7xl space-y-3 md:space-y-6 p-3 md:p-8 animate-fade-in">
      <PageHeader
        title="Cierre mensual"
        subtitle="Resultado del mes: ingresos, egresos y utilidad del salón."
        actions={
          <>
            {/* Navegacion de mes */}
            <div className="flex items-center gap-1 rounded-2xl border border-gray-100 bg-brand-light p-1">
              <button
                onClick={() => changeMonth(-1)}
                aria-label="Mes anterior"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-gray transition-colors hover:bg-white hover:text-brand-blue dark:hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              </button>
              <span className="min-w-[150px] text-center text-sm font-bold text-brand-dark">
                {monthNames[month - 1]} {year}
              </span>
              <button
                onClick={() => changeMonth(1)}
                aria-label="Mes siguiente"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-gray transition-colors hover:bg-white hover:text-brand-blue dark:hover:bg-white/10"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <a href={`/api/reportes/pdf?month=${month}&year=${year}`} className={primaryButton}>
              <FileDown className="h-4 w-4" strokeWidth={2} /> Descargar PDF
            </a>
          </>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          hero
          className="col-span-2 lg:col-span-2"
          label="Movimiento total (bruto)"
          value={<AnimatedNumber value={data.summary.totalIncome} format={formatCurrency} />}
          Icon={Coins}
          hint="Incluye ventas de arrendatarios"
        />
        <StatCard
          label="Ingresos comisión"
          value={<AnimatedNumber value={data.summary.incomeCommission} format={formatCurrency} />}
          Icon={Percent}
          tone="violet"
          hint="Ingresa al salón"
        />
        <StatCard
          label="Ingresos arriendo"
          value={<AnimatedNumber value={data.summary.incomeRental} format={formatCurrency} />}
          Icon={KeyRound}
          tone="amber"
          hint="No ingresa al salón"
        />
        <StatCard
          label="Egresos"
          value={<AnimatedNumber value={data.summary.totalExpenses} format={formatCurrency} />}
          Icon={TrendingDown}
          tone="red"
        />
        <StatCard
          label="Utilidad salón"
          value={<AnimatedNumber value={data.summary.salonNetIncome} format={formatCurrency} />}
          Icon={PiggyBank}
          tone="green"
          hint="Comisión − egresos"
        />
        <StatCard label="Ingresos y egresos" hint={data.summary.incomeCount !== undefined ? `${data.summary.incomeCount} ingresos · ${data.summary.expenseCount} egresos` : undefined} value={<AnimatedNumber value={data.summary.totalTransactions} />} Icon={Receipt} tone="slate" />
        <StatCard label="Citas completadas" value={<AnimatedNumber value={data.summary.appointmentsCompleted} />} Icon={CalendarCheck} tone="teal" />
        <StatCard label="Clientes nuevos" value={<AnimatedNumber value={data.summary.newClients} />} Icon={UserPlus} tone="green" />
      </div>

      {/* Comparativa mensual: mismo estilo de gráfico que el Dashboard */}
      {comparison.length > 0 && (
        <Panel title="Comparativa mensual" subtitle="Últimos 6 meses">
          <ComparativaChart data={comparison} />
        </Panel>
      )}

      {/* Ventas sin profesional (negocios con equipo): avisa para poder asignarlas antes de cerrar el mes */}
      {data.resumenCuadra && data.resumenCuadra.ventasSinProfesional > 0 && (
        <div className="rounded-2xl border border-brand-blue/30 bg-brand-blue/5 px-4 py-3 text-sm text-brand-dark">
          <b>{data.resumenCuadra.ventasSinProfesional} {data.resumenCuadra.ventasSinProfesional === 1 ? "venta" : "ventas"} sin profesional</b> ({formatCurrency(data.resumenCuadra.montoSinProfesional)}). Aparecen aparte en «Ingresos por profesional». Para asignarlas, entra a Ingresos/Egresos, toca Modificar en cada venta y elige «Corresponde a: Profesional».
        </div>
      )}

      {/* Resumen que cuadra: de lo que se cobró por servicios y productos al total del mes */}
      {data.resumenCuadra && data.resumenCuadra.totalIngresos > 0 && (
        <Panel title="Resumen que cuadra" subtitle="De los servicios a precio de lista al movimiento total">
          <div className="space-y-1.5 text-sm">
            {([
              ["Servicios a precio de lista", data.resumenCuadra.serviciosLista, false],
              ["− Descuentos y ajustes", -data.resumenCuadra.descuentos, false],
              ["= Servicios cobrados", data.resumenCuadra.serviciosCobrado, true],
              ["+ Productos cobrados", data.resumenCuadra.productosCobrado, false],
              ...(data.resumenCuadra.sinDetalle > 0 ? [["+ Ventas sin detalle de servicio o producto", data.resumenCuadra.sinDetalle, false]] : []),
              // Abonos: lo que la clienta pagó al reservar entra el mes en que lo pagó; en la venta no es un descuento.
              ...((data.resumenCuadra.abonosAplicados || 0) > 0 ? [["− Pagado antes como abono (ya contado cuando se recibió)", -(data.resumenCuadra.abonosAplicados || 0), false]] : []),
              ...((data.resumenCuadra.abonosAplicados || 0) > 0 || (data.resumenCuadra.abonosRecibidos || 0) > 0 ? [["= Cobrado en el mes", data.resumenCuadra.cobradoEnElMes ?? 0, true]] : []),
              ...((data.resumenCuadra.abonosRecibidos || 0) > 0 ? [["+ Abonos recibidos en el mes (reservas pagadas este mes)", data.resumenCuadra.abonosRecibidos || 0, false]] : []),
              ["= Movimiento total (ingresos)", data.resumenCuadra.totalIngresos, true],
            ] as [string, number, boolean][]).map(([nombre, monto, fuerte]) => (
              <div key={nombre} className={`flex items-center justify-between gap-3 ${fuerte ? "border-t border-gray-100 pt-1.5 font-bold text-brand-dark" : "text-brand-gray"}`}>
                <span>{nombre}</span><span className="tabular-nums">{monto < 0 ? "−" : ""}{formatCurrency(Math.abs(monto))}</span>
              </div>
            ))}
          </div>
          <p className={`mt-3 rounded-xl px-3 py-2 text-xs ${data.resumenCuadra.cuadra ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {data.resumenCuadra.cuadra
              ? `Cuadra: los ingresos suman igual en todas las tablas.${data.resumenCuadra.ventasAjustadas > 0 ? ` ${data.resumenCuadra.ventasAjustadas} ${data.resumenCuadra.ventasAjustadas === 1 ? "venta tenía" : "ventas tenían"} líneas que sumaban distinto de lo cobrado y se ajustaron.` : ""}`
              : `No cuadra: hay una diferencia de ${formatCurrency(Math.abs(data.resumenCuadra.diferencia))}. Revisa las ventas del mes.`}
          </p>
        </Panel>
      )}

      {/* Tables Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Income by Barber */}
        <Panel flush title="Ingresos por profesional">
          <div className={ts.wrap}>
            <table className={ts.table}>
              <thead className={ts.thead}>
                <tr>
                  <th className={ts.th}>Profesional</th>
                  <th className={ts.thCenter}>Modo</th>
                  <th className={ts.thRight}>Total</th>
                </tr>
              </thead>
              <tbody className={ts.tbody}>
                {data.incomeByBarber?.map((row, i) => (
                  <tr key={i} className={ts.tr}>
                    <td className={ts.td}>{row.name}</td>
                    <td className={ts.tdCenter}>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          row.workMode === "rental" ? "bg-amber-500/10 text-amber-500" : "bg-violet-500/10 text-violet-500"
                        }`}
                      >
                        {row.workMode === "rental" ? "Arriendo" : "Comisión"}
                      </span>
                    </td>
                    <td className={ts.tdRight}>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* By Payment Method */}
        <Panel flush title="Por método de pago">
          <div className={ts.wrap}>
            <table className={ts.table}>
              <thead className={ts.thead}>
                <tr>
                  <th className={ts.th}>Método</th>
                  <th className={ts.thRight}>Total</th>
                </tr>
              </thead>
              <tbody className={ts.tbody}>
                {data.incomeByMethod?.map((row, i) => (
                  <tr key={i} className={ts.tr}>
                    <td className={ts.td}>{paymentMethodLabels[row.method] || row.method}</td>
                    <td className={ts.tdRight}>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Top Services */}
        <Panel flush title="Top servicios">
          <div className={ts.wrap}>
            <table className={ts.table}>
              <thead className={ts.thead}>
                <tr>
                  <th className={ts.th}>Servicio</th>
                  <th className={ts.thCenter}>Cantidad</th>
                  <th className={ts.thRight}>Lista</th>
                  <th className={ts.thRight}>Descuentos</th>
                  <th className={ts.thRight}>Cobrado</th>
                </tr>
              </thead>
              <tbody className={ts.tbody}>
                {data.topServices?.map((row, i) => (
                  <tr key={i} className={ts.tr}>
                    <td className={ts.td}>{row.name}</td>
                    <td className={ts.tdCenter}>{row.count}</td>
                    <td className={ts.tdRight}>{formatCurrency(row.lista ?? row.total)}</td>
                    <td className={ts.tdRight}>{(row.descuentos ?? 0) > 0.5 ? `−${formatCurrency(row.descuentos!)}` : "—"}</td>
                    <td className={ts.tdRight}>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Top Products */}
        <Panel flush title="Top productos">
          <div className={ts.wrap}>
            <table className={ts.table}>
              <thead className={ts.thead}>
                <tr>
                  <th className={ts.th}>Producto</th>
                  <th className={ts.thCenter}>Cantidad</th>
                  <th className={ts.thRight}>Total</th>
                </tr>
              </thead>
              <tbody className={ts.tbody}>
                {data.topProducts?.map((row, i) => (
                  <tr key={i} className={ts.tr}>
                    <td className={ts.td}>{row.name}</td>
                    <td className={ts.tdCenter}>{row.count}</td>
                    <td className={ts.tdRight}>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Detalle de egresos: lista simple (concepto y monto), sin columnas de relleno. */}
        <Panel title="Detalle de egresos">
          {(!data.expensesDetail || data.expensesDetail.length === 0) ? (
            <p className="py-8 text-center text-sm text-brand-gray">Sin egresos en este periodo</p>
          ) : (
            <div>
              <ul className="divide-y divide-gray-100">
                {data.expensesDetail.map((row, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-4 py-2.5">
                    {/* El sufijo " (gasto fijo)" es de registros guardados antes del cambio de nombre. */}
                    <span className="min-w-0 truncate text-sm text-brand-dark">{row.name.replace(" (gasto fijo)", "")}</span>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-red-500">{formatCurrency(row.total)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-gray-200 pt-3">
                <span className="text-sm font-bold text-brand-dark">Total egresos</span>
                <span className="text-base font-bold tabular-nums text-red-500">{formatCurrency(data.summary.totalExpenses)}</span>
              </div>
            </div>
          )}
        </Panel>

        {/* Gastos del mes y cerrar / reabrir (solo administrador), al lado de los egresos. */}
        {isAtLeast("admin") && <MonthClosePanel month={month} year={year} onChanged={fetchReport} />}
      </div>
    </div>
  );
}
