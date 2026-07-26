"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

interface DashboardData {
  todayIncome: number;
  monthIncome: number;
  weekTotal: number;
  weekData: Array<{ day: string; total: number }>;
  totalClients: number;
  todayAppointments: Array<{
    id: string;
    start_time: string;
    status: string;
    client: { name: string; phone: string | null } | null;
    barber: { name: string } | null;
    services: Array<{ service: { name: string } }>;
  }>;
  todayApptCount: number;
  lowStock: Array<{ id: string; name: string; stock: number; min_stock: number }>;
}

const statusLabels: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  in_progress: "En Atencion",
};

const statusColors: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <Spinner />;

  const maxWeekValue = Math.max(...data.weekData.map((d) => d.total), 1);

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500">Resumen de EstudioLevels</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl shadow-lg shadow-green-500/20 p-4 md:p-5 text-white">
          <p className="text-[10px] md:text-xs uppercase opacity-80 font-medium">Hoy</p>
          <p className="text-lg md:text-2xl font-bold mt-0.5">{formatCurrency(data.todayIncome)}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl shadow-lg shadow-blue-500/20 p-4 md:p-5 text-white">
          <p className="text-[10px] md:text-xs uppercase opacity-80 font-medium">Semana</p>
          <p className="text-lg md:text-2xl font-bold mt-0.5">{formatCurrency(data.weekTotal)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl shadow-lg shadow-purple-500/20 p-4 md:p-5 text-white">
          <p className="text-[10px] md:text-xs uppercase opacity-80 font-medium">Mes</p>
          <p className="text-lg md:text-2xl font-bold mt-0.5">{formatCurrency(data.monthIncome)}</p>
        </div>
        <div className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-2xl shadow-lg shadow-gray-900/20 p-4 md:p-5 text-white">
          <p className="text-[10px] md:text-xs uppercase opacity-80 font-medium">Citas Hoy</p>
          <p className="text-lg md:text-2xl font-bold mt-0.5">{data.todayApptCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
          <h3 className="font-bold text-gray-800 mb-4 text-sm md:text-base">Ventas de la Semana</h3>
          <div className="flex items-end justify-between gap-2 md:gap-3 h-44 md:h-52">
            {data.weekData.map((d, i) => {
              const barHeight = maxWeekValue > 0 ? Math.max((d.total / maxWeekValue) * 160, 8) : 8;
              const isToday = i === data.weekData.length - 1;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[9px] md:text-[10px] text-gray-400 mb-1 font-medium">
                    {d.total > 0 ? formatCurrency(d.total) : ""}
                  </span>
                  <div
                    className={`w-full max-w-[32px] md:max-w-[40px] rounded-t-xl transition-all ${
                      isToday
                        ? "bg-gradient-to-t from-blue-700 to-blue-400 shadow-md shadow-blue-500/30"
                        : "bg-gradient-to-t from-blue-200 to-blue-100"
                    }`}
                    style={{ height: `${barHeight}px` }}
                  />
                  <span className={`text-[10px] md:text-xs mt-2 font-medium ${isToday ? "text-blue-600" : "text-gray-400"}`}>
                    {d.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Low stock alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
          <h3 className="font-bold text-gray-800 mb-4 text-sm md:text-base">Alertas Stock</h3>
          {data.lowStock.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Todo en orden</p>
          ) : (
            <div className="space-y-3">
              {data.lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{p.name}</span>
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                    {p.stock}/{p.min_stock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Today's appointments */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-sm md:text-base">Citas de Hoy</h3>
          <a href="/dashboard/calendario" className="text-xs text-blue-600 hover:underline font-medium">Ver calendario →</a>
        </div>
        {data.todayAppointments.length === 0 ? (
          <p className="p-6 text-center text-gray-400">No hay citas pendientes para hoy</p>
        ) : (
          <div className="divide-y">
            {data.todayAppointments.map((appt: any) => (
              <div key={appt.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[50px]">
                    <p className="text-lg font-bold text-blue-600">
                      {new Date(appt.start_time).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{appt.client?.name || "Cliente"}</p>
                    <p className="text-xs text-gray-500">
                      {appt.barber?.name} · {appt.services?.map((s: any) => s.service?.name).join(", ")}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[appt.status] || ""}`}>
                  {statusLabels[appt.status] || appt.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-5 text-center">
          <p className="text-3xl font-bold text-gray-900">{data.totalClients}</p>
          <p className="text-xs text-gray-500 uppercase mt-1">Clientes Totales</p>
        </div>
        <a href="/dashboard/booking" className="bg-white rounded-lg shadow p-5 text-center hover:shadow-md transition-shadow">
          <p className="text-3xl font-bold text-blue-600">24/7</p>
          <p className="text-xs text-gray-500 uppercase mt-1">Booking Online</p>
        </a>
        <a href="/dashboard/retencion" className="bg-white rounded-lg shadow p-5 text-center hover:shadow-md transition-shadow">
          <p className="text-3xl font-bold text-red-600">♥</p>
          <p className="text-xs text-gray-500 uppercase mt-1">Retencion</p>
        </a>
      </div>
    </div>
  );
}
