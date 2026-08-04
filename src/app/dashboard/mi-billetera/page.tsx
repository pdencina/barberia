"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface WalletData {
  barber: { name: string; mode: string; commissionRate: number; rentalRate: number };
  month: { earned: number; totalSales: number; projected: number; projectedFromAppts: number; txCount: number; upcomingAppts: number };
  today: { earnings: number; sales: number };
  dailyEarnings: Array<{ day: string; amount: number }>;
}

export default function MiBilleteraPage() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/wallet?barberId=${user.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.barber) setData(d); })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading || !data) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }

  const maxDaily = Math.max(...data.dailyEarnings.map((d) => d.amount), 1);
  const monthName = new Date().toLocaleDateString("es-CL", { month: "long" });
  const progressPercent = data.month.projected > 0 ? Math.min((data.month.earned / data.month.projected) * 100, 100) : 0;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
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

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-xl font-bold text-brand-dark">{formatCurrency(data.today.earnings)}</p>
          <p className="text-[10px] text-brand-gray uppercase mt-1">Hoy</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-xl font-bold text-brand-dark">{data.month.txCount}</p>
          <p className="text-[10px] text-brand-gray uppercase mt-1">Atenciones</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-xl font-bold text-brand-accent">{data.month.upcomingAppts}</p>
          <p className="text-[10px] text-brand-gray uppercase mt-1">Pendientes</p>
        </div>
      </div>

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
