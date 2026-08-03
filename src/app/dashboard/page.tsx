"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

interface DashboardData {
  stats: {
    reservasHoy: number;
    reservasChange: number;
    ventasHoy: number;
    ventasChange: number;
    clientesNuevos: number;
    clientesChange: number;
    reagendamientos: number;
    reagendamientosChange: number;
    cancelaciones: number;
    cancelacionesChange: number;
  };
  todayAppointments: Array<{
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    client: { name: string } | null;
    barber: { name: string } | null;
    services: Array<{ service: { name: string } }>;
  }>;
  topServices: Array<{ name: string; count: number }>;
  weekData: Array<{ day: string; date: string; total: number }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <Spinner />;

  const firstName = user?.name?.split(" ")[0] || "Usuario";
  const today = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });

  const StatChange = ({ value }: { value: number }) => (
    <span className={`text-xs font-medium ${value >= 0 ? "text-green-600" : "text-red-500"}`}>
      {value >= 0 ? "+" : ""}{value}% vs ayer
    </span>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-dark">
            Hola, {firstName}! 👋
          </h1>
          <p className="text-brand-gray text-sm mt-0.5">
            Aqui tienes el resumen de tu negocio hoy.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 text-sm text-brand-gray">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="capitalize">{today}</span>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
          <p className="text-xs text-brand-gray font-medium">Reservas hoy</p>
          <p className="text-3xl font-bold text-brand-dark mt-1">{data.stats.reservasHoy}</p>
          <StatChange value={data.stats.reservasChange} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
          <p className="text-xs text-brand-gray font-medium">Ventas hoy</p>
          <p className="text-3xl font-bold text-brand-dark mt-1">{formatCurrency(data.stats.ventasHoy)}</p>
          <StatChange value={data.stats.ventasChange} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
          <p className="text-xs text-brand-gray font-medium">Clientes nuevos</p>
          <p className="text-3xl font-bold text-brand-dark mt-1">{data.stats.clientesNuevos}</p>
          <StatChange value={data.stats.clientesChange} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
          <p className="text-xs text-brand-gray font-medium">Reagendamientos</p>
          <p className="text-3xl font-bold text-brand-dark mt-1">{data.stats.reagendamientos}</p>
          <StatChange value={data.stats.reagendamientosChange} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
          <p className="text-xs text-brand-gray font-medium">Cancelaciones</p>
          <p className="text-3xl font-bold text-brand-dark mt-1">{data.stats.cancelaciones}</p>
          <StatChange value={data.stats.cancelacionesChange} />
        </div>
      </div>

      {/* Weekly Sales Chart */}
      {data.weekData && data.weekData.length > 0 && (() => {
        const maxVal = Math.max(...data.weekData.map((d) => d.total), 1);
        const weekTotal = data.weekData.reduce((s, d) => s + d.total, 0);
        return (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-brand-dark">Ventas de la semana</h3>
                <p className="text-xs text-brand-gray mt-0.5">Ultimos 7 dias · Total: {formatCurrency(weekTotal)}</p>
              </div>
              <Link href="/dashboard/reportes" className="text-xs text-brand-blue font-medium hover:underline">
                Ver reportes →
              </Link>
            </div>
            <div className="flex items-end justify-between gap-2 h-44">
              {data.weekData.map((d, i) => {
                const barHeight = maxVal > 0 ? Math.max((d.total / maxVal) * 140, 4) : 4;
                const isToday = i === data.weekData.length - 1;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group">
                    {/* Amount tooltip on hover */}
                    <span className="text-[9px] text-brand-gray mb-1 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.total > 0 ? formatCurrency(d.total) : "-"}
                    </span>
                    <div
                      className={`w-full max-w-[36px] rounded-xl transition-all ${
                        isToday
                          ? "bg-gradient-to-t from-brand-blue to-blue-400 shadow-md shadow-brand-blue/20"
                          : d.total > 0
                          ? "bg-gradient-to-t from-blue-200 to-blue-100"
                          : "bg-gray-100"
                      }`}
                      style={{ height: `${barHeight}px` }}
                    />
                    <span className={`text-[11px] mt-2 font-medium ${isToday ? "text-brand-blue" : "text-brand-gray"}`}>
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Main content: Agenda + Top Services */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Agenda de hoy */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-brand-dark">Agenda de hoy</h3>
            <Link href="/dashboard/calendario" className="text-xs text-brand-blue font-medium hover:underline">
              Ver agenda completa →
            </Link>
          </div>

          {data.todayAppointments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📅</div>
              <p className="text-brand-gray text-sm">No hay citas agendadas para hoy</p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.todayAppointments.map((appt) => {
                const time = appt.start_time?.match(/(\d{2}:\d{2})/)?.[1] || "";
                const serviceName = appt.services?.map((s: any) => s.service?.name).join(" + ") || "Servicio";
                return (
                  <div key={appt.id} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-brand-gray font-medium w-12">{time}</span>
                    <div className="flex-1 flex items-center gap-3">
                      <div className="w-1 h-10 rounded-full bg-brand-blue/60" />
                      <div>
                        <p className="text-sm font-semibold text-brand-dark">{serviceName}</p>
                        <p className="text-xs text-brand-gray">{appt.client?.name || "Cliente"} · {appt.barber?.name}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Servicios */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-brand-dark">Top Servicios</h3>
            <Link href="/dashboard/reportes" className="text-xs text-brand-blue font-medium hover:underline">
              Ver reporte completo →
            </Link>
          </div>

          {data.topServices.length === 0 ? (
            <p className="text-center py-8 text-brand-gray text-sm">Sin datos aun</p>
          ) : (
            <div className="space-y-4">
              {data.topServices.map((svc, i) => (
                <div key={svc.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-brand-gray font-medium w-4">{i + 1}</span>
                    <span className="text-sm text-brand-dark font-medium">{svc.name}</span>
                  </div>
                  <span className="text-sm font-bold text-brand-dark">{svc.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
