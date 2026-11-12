"use client";

import { useState, useEffect } from "react";
import { formatCurrency, todayInChile, dateStrOffset } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { ChevronRight, PiggyBank } from "lucide-react";
import { CrecimientoBilletera } from "@/components/finance/crecimiento-billetera";

interface WalletMovement {
  id: string;
  createdAt: string;
  clientName: string;
  service: string;
  amount: number;
  paymentMethod: string;
  paymentMethodLabel: string;
  tip?: number;
  payments?: { label: string; amount: number }[];
  items?: { name: string; quantity: number; total: number }[];
}

interface WalletData {
  barber: { name: string; mode: string; commissionRate: number; rentalRate: number };
  month: { earned: number; totalSales: number; projected: number; projectedFromAppts: number; txCount: number; upcomingAppts: number; tips?: number };
  today: { earnings: number; sales: number; tips?: number };
  dailyEarnings: Array<{ day: string; amount: number }>;
  movements: WalletMovement[];
  movementsRange: { from: string; to: string };
}

// Entrada a «Mis gastos personales» (sueldo, ahorro, torta del mes, reporte y gastos con Oti): es privado, vive en su propia pantalla.
function BotonGastosPersonales() {
  return (
    <Link href="/dashboard/mi-billetera/personal" className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 transition-colors hover:border-brand-blue/40 hover:bg-brand-blue/[0.03]">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue"><PiggyBank className="h-5 w-5" strokeWidth={1.75} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-brand-dark">Mis gastos personales</span>
        <span className="block text-xs text-brand-gray">Tu sueldo, ahorro, torta del mes, reporte y gastos con Oti</span>
      </span>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-brand-gray" />
    </Link>
  );
}

export default function MiBilleteraPage() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  // Punto 16 (Pablo): selector de fecha/rango para revisar el detalle diario de
  // movimientos. Por defecto, hoy (igual que antes de que existiera el selector).
  const [dateFrom, setDateFrom] = useState(todayInChile());
  const [dateTo, setDateTo] = useState(todayInChile());

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    const params = new URLSearchParams({ barberId: user.id, from: dateFrom, to: dateTo });
    fetch(`/api/wallet?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => { if (d.barber) setData(d); })
      .finally(() => setLoading(false));
  }, [user, dateFrom, dateTo]);

  const setQuickRange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }
  // Sin datos de comisiones/arriendo (por ejemplo un administrador sin agenda propia): igual se muestran los gastos personales.
  if (!data) {
    return (
      <div className="p-3 md:p-6 max-w-2xl mx-auto space-y-3 md:space-y-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brand-dark">Mi Billetera</h1>
          <p className="text-sm text-brand-gray">Tus gastos e ingresos personales</p>
        </div>
        <BotonGastosPersonales />
      </div>
    );
  }

  const maxDaily = Math.max(...data.dailyEarnings.map((d) => d.amount), 1);
  const monthName = new Date().toLocaleDateString("es-CL", { month: "long" });
  const progressPercent = data.month.projected > 0 ? Math.min((data.month.earned / data.month.projected) * 100, 100) : 0;

  return (
    <div className="p-3 md:p-6 max-w-2xl mx-auto space-y-3 md:space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-brand-dark">Mi Billetera</h1>
        <p className="text-sm text-brand-gray">
          {data.barber.mode === "commission"
            ? `Comision: ${data.barber.commissionRate}% de cada venta`
            : `Arriendo: ${formatCurrency(data.barber.rentalRate || 0)}/dia`}
        </p>
      </div>

      {/* Main earning card */}
      <div className="bg-gradient-to-br from-[#0F8B8D] to-[#0a6b6d] rounded-2xl p-6 text-white shadow-xl shadow-[#0F8B8D]/20">
        <p className="text-sm opacity-80">Ganado en {monthName}</p>
        <p className="text-4xl font-bold mt-1">{formatCurrency(data.month.earned)}</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-[#2EC4B6] rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <p className="text-sm opacity-80">{Math.round(progressPercent)}%</p>
        </div>
        <p className="text-xs opacity-60 mt-2">
          Proyeccion mes: {formatCurrency(data.month.projected)}
        </p>
      </div>

      {/* Propinas: van 100% al profesional */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-gray">Propinas de {monthName}</p>
          <p className="text-2xl font-bold text-brand-dark">{formatCurrency(data.month.tips || 0)}</p>
          <p className="text-[11px] text-brand-gray">Van 100% para ti. No están incluidas en lo ganado por comisión.</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-brand-gray">Hoy</p>
          <p className="text-base font-bold text-brand-accent">{formatCurrency(data.today.tips || 0)}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center sm:p-4">
          <p className="text-base font-bold sm:text-xl text-brand-dark">{formatCurrency(data.today.earnings)}</p>
          <p className="text-[10px] text-brand-gray uppercase mt-1">Hoy</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center sm:p-4">
          <p className="text-base font-bold sm:text-xl text-brand-dark">{data.month.txCount}</p>
          <p className="text-[10px] text-brand-gray uppercase mt-1">Atenciones</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center sm:p-4">
          <p className="text-base font-bold sm:text-xl text-brand-accent">{data.month.upcomingAppts}</p>
          <p className="text-[10px] text-brand-gray uppercase mt-1">Pendientes</p>
        </div>
      </div>

      {/* Entrada a las finanzas personales (privadas) */}
      <BotonGastosPersonales />

      {/* Projection breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-brand-dark text-sm mb-3">Proyeccion del mes</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-gray">Ya ganado</span>
            <span className="font-medium text-brand-dark">{formatCurrency(data.month.earned)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-gray">Por citas agendadas ({data.month.upcomingAppts})</span>
            <span className="font-medium text-brand-accent">+{formatCurrency(data.month.projectedFromAppts)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-100">
            <span className="font-bold text-brand-dark">Total proyectado</span>
            <span className="font-bold text-brand-blue">{formatCurrency(data.month.projected)}</span>
          </div>
        </div>
      </div>

      {/* Daily chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-brand-dark text-sm mb-4">Ultimos 7 dias</h3>
        <div className="flex items-end justify-between gap-2 h-32">
          {data.dailyEarnings.map((d, i) => {
            const barHeight = maxDaily > 0 ? Math.max((d.amount / maxDaily) * 100, 4) : 4;
            const isToday = i === data.dailyEarnings.length - 1;
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-[9px] text-brand-gray mb-1">
                  {d.amount > 0 ? formatCurrency(d.amount) : ""}
                </span>
                <div
                  className={`w-full max-w-[28px] rounded-lg transition-all ${
                    isToday ? "bg-gradient-to-t from-[#0F8B8D] to-[#2EC4B6]" : "bg-gray-200"
                  }`}
                  style={{ height: `${barHeight}%` }}
                />
                <span className={`text-[10px] mt-1 ${isToday ? "text-brand-blue font-bold" : "text-brand-gray"}`}>
                  {d.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detalle diario de movimientos (Punto 16) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-brand-dark text-sm mb-3">Detalle de movimientos</h3>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setQuickRange(todayInChile(), todayInChile())}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${dateFrom === todayInChile() && dateTo === todayInChile() ? "bg-brand-blue text-white" : "bg-gray-100 text-brand-gray hover:bg-gray-200"}`}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setQuickRange(dateStrOffset(todayInChile(), -1), dateStrOffset(todayInChile(), -1))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${dateFrom === dateStrOffset(todayInChile(), -1) && dateTo === dateStrOffset(todayInChile(), -1) ? "bg-brand-blue text-white" : "bg-gray-100 text-brand-gray hover:bg-gray-200"}`}
          >
            Ayer
          </button>
          <button
            type="button"
            onClick={() => setQuickRange(dateStrOffset(todayInChile(), -6), todayInChile())}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-brand-gray hover:bg-gray-200"
          >
            Ultimos 7 dias
          </button>
          <div className="flex items-center gap-1.5 ml-auto">
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => e.target.value && setDateFrom(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-xs"
            />
            <span className="text-brand-gray text-xs">a</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayInChile()}
              onChange={(e) => e.target.value && setDateTo(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-xs"
            />
          </div>
        </div>

        {data.movements.length === 0 ? (
          <p className="text-center py-6 text-brand-gray text-sm">Sin movimientos en ese periodo</p>
        ) : (
          <div className="divide-y divide-gray-50 -mx-1">
            {data.movements.map((m) => {
              const when = new Intl.DateTimeFormat("es-CL", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Santiago",
              }).format(new Date(m.createdAt));
              return (
                <div key={m.id} className="py-3 px-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm font-semibold text-brand-dark break-words">{m.clientName}</p>
                    <span className="flex-shrink-0 text-sm font-bold text-brand-dark">{formatCurrency(m.amount)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-brand-gray break-words">{(m.items && m.items.length > 0) ? m.items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ""}${i.name}`).join(" + ") : m.service}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-brand-gray">{when}</span>
                    {m.payments && m.payments.length > 0
                      ? m.payments.map((p, k) => <span key={k} className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-brand-dark">{p.label} {formatCurrency(p.amount)}</span>)
                      : <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-brand-dark">{m.paymentMethodLabel}</span>}
                    {(m.tip || 0) > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Propina {formatCurrency(m.tip || 0)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Crecimiento: dos gráficos separados (lo que ganas y tus clientes) */}
      <CrecimientoBilletera />


      {/* Info */}
      <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-2xl p-4 text-xs text-brand-blue">
        <p className="font-medium mb-1">Como se calcula?</p>
        {data.barber.mode === "commission" ? (
          <p>Tu ganancia es el {data.barber.commissionRate}% de cada venta que realizas. La proyeccion se basa en las citas ya agendadas para el resto del mes.</p>
        ) : (
          <p>Como profesional en arriendo, tus ventas son tuyas. El arriendo de estacion se descuenta por separado en el cierre mensual.</p>
        )}
      </div>
    </div>
  );
}
