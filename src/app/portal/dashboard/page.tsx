"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface PortalData {
  client: {
    name: string;
    email: string | null;
    phone: string | null;
    loyaltyPoints: number;
    memberSince: string;
    totalVisits: number;
  };
  upcoming: Array<{
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    status: string;
    barber: { name: string } | null;
    services: Array<{ service: { name: string; price: number } }>;
  }>;
  history: Array<{
    id: string;
    date: string;
    start_time: string;
    status: string;
    barber: { name: string } | null;
    services: Array<{ service: { name: string; price: number } }>;
  }>;
  pointsHistory: Array<{
    id: string;
    points: number;
    reason: string;
    created_at: string;
  }>;
}

const statusLabels: Record<string, string> = {
  scheduled: "Agendada", confirmed: "Confirmada", completed: "Completada",
  cancelled: "Cancelada", no_show: "No asistio",
};
const statusColors: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-700", confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700", cancelled: "bg-red-100 text-red-700",
  no_show: "bg-gray-100 text-gray-700",
};
const reasonLabels: Record<string, string> = {
  purchase: "Compra", referral: "Referido", bonus: "Bono", redemption: "Canje",
};

export default function PortalDashboard() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "history" | "points">("upcoming");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const clientId = localStorage.getItem("portal_client_id");
    if (!clientId) {
      router.replace("/portal");
      return;
    }
    fetch(`/api/portal/data?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d) => { if (d.client) setData(d); else router.replace("/portal"); })
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = async (appointmentId: string) => {
    setCancelling(appointmentId);
    const res = await fetch("/api/public/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId }),
    });
    if (res.ok) {
      // Refresh data
      const clientId = localStorage.getItem("portal_client_id");
      const d = await fetch(`/api/portal/data?clientId=${clientId}`).then((r) => r.json());
      setData(d);
    }
    setCancelling(null);
  };

  const logout = () => {
    localStorage.removeItem("portal_client_id");
    localStorage.removeItem("portal_client_name");
    localStorage.removeItem("portal_token");
    router.push("/portal");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-light flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const firstName = data.client.name.split(" ")[0];

  return (
    <div className="min-h-screen bg-brand-light">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <img src="/logo.png" alt="re-booking" className="h-7" />
          <button onClick={logout} className="text-xs text-brand-gray hover:text-brand-blue">
            Cerrar sesion
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Hola, {firstName} 👋</h1>
          <p className="text-sm text-brand-gray">Bienvenido a tu portal</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-brand-blue">{data.client.totalVisits}</p>
            <p className="text-[10px] text-brand-gray uppercase mt-1">Visitas</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-brand-blue">{data.client.loyaltyPoints}</p>
            <p className="text-[10px] text-brand-gray uppercase mt-1">Puntos</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-brand-blue">{data.upcoming.length}</p>
            <p className="text-[10px] text-brand-gray uppercase mt-1">Proximas</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-xl border border-gray-100 p-1 gap-1">
          {[
            { key: "upcoming", label: "Proximas" },
            { key: "history", label: "Historial" },
            { key: "points", label: "Puntos" },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-brand-blue text-white shadow-sm" : "text-brand-gray hover:text-brand-dark"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "upcoming" && (
          <div className="space-y-3">
            {data.upcoming.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <img src="/oti/feliz.png" alt="Oti" className="w-16 h-16 mx-auto mb-2" />
                <p className="text-brand-gray text-sm">No tienes citas agendadas</p>
                <a href="/booking" className="mt-4 inline-block px-5 py-2 bg-brand-blue text-white text-sm font-medium rounded-xl hover:bg-blue-700">
                  Agendar cita
                </a>
              </div>
            ) : data.upcoming.map((appt) => {
              const time = appt.start_time?.match(/(\d{2}:\d{2})/)?.[1] || "";
              const services = appt.services?.map((s: any) => s.service?.name).join(" + ") || "";
              const dateStr = new Date(appt.date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
              return (
                <div key={appt.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-brand-dark">{services}</p>
                      <p className="text-sm text-brand-gray">{appt.barber?.name}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[appt.status] || ""}`}>
                      {statusLabels[appt.status] || appt.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-brand-gray">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
                      {dateStr}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      {time}
                    </span>
                  </div>
                  {["scheduled", "confirmed"].includes(appt.status) && (
                    <button
                      onClick={() => handleCancel(appt.id)}
                      disabled={cancelling === appt.id}
                      className="mt-3 w-full py-2 border border-red-200 text-red-500 text-sm rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {cancelling === appt.id ? "Cancelando..." : "Cancelar cita"}
                    </button>
                  )}
                </div>
              );
            })}
            <a href="/booking" className="block w-full py-3 bg-brand-blue text-white text-sm font-medium text-center rounded-xl hover:bg-blue-700">
              + Agendar nueva cita
            </a>
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-2">
            {data.history.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <p className="text-brand-gray text-sm">Aun no tienes historial</p>
              </div>
            ) : data.history.map((appt) => {
              const services = appt.services?.map((s: any) => s.service?.name).join(" + ") || "";
              const dateStr = new Date(appt.date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
              return (
                <div key={appt.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-brand-dark">{services}</p>
                    <p className="text-xs text-brand-gray">{dateStr} · {appt.barber?.name}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[appt.status] || ""}`}>
                    {statusLabels[appt.status]}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {tab === "points" && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-brand-blue to-blue-700 rounded-2xl p-5 text-white text-center">
              <p className="text-xs uppercase opacity-80">Tus puntos</p>
              <p className="text-4xl font-bold mt-1">{data.client.loyaltyPoints}</p>
              <p className="text-xs opacity-60 mt-2">Acumula puntos con cada visita</p>
            </div>

            {data.pointsHistory.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <p className="text-brand-gray text-sm">Sin movimientos de puntos</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {data.pointsHistory.map((p) => (
                  <div key={p.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-brand-dark">{reasonLabels[p.reason] || p.reason}</p>
                      <p className="text-xs text-brand-gray">{new Date(p.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</p>
                    </div>
                    <span className={`text-sm font-bold ${p.points >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {p.points >= 0 ? "+" : ""}{p.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
