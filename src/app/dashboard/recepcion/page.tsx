"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Appointment {
  id: string;
  time: string;
  client_name: string;
  client_phone: string;
  barber_name: string;
  services: string[];
  status: string;
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  in_progress: "En Atencion",
  completed: "Completada",
  cancelled: "Cancelada",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function RecepcionPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  const fetchAppointments = async () => {
    try {
      const res = await fetch(`/api/appointments?date=${today}`);
      setAppointments(await res.json());
    } catch (err) {
      console.error("Error fetching appointments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();

    // Clock update every second
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);

    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(fetchAppointments, 30000);

    // Supabase realtime subscription
    const supabase = createClient();
    const channel = supabase
      .channel("appointments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        fetchAppointments();
      })
      .subscribe();

    return () => {
      clearInterval(clockInterval);
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchAppointments();
  };

  const inProgress = appointments.filter((a) => a.status === "in_progress");
  const upcoming = appointments.filter((a) => a.status === "pending" || a.status === "confirmed");
  const completed = appointments.filter((a) => a.status === "completed");

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header with Clock */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-5xl font-bold text-gray-900 tabular-nums">
            {currentTime.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
          <p className="text-lg text-gray-500">
            {currentTime.toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <button onClick={fetchAppointments}
          className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 shadow-sm">
          Actualizar
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Cargando...</p>
      ) : (
        <>
          {/* En Atencion */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">En Atencion</h2>
            {inProgress.length === 0 ? (
              <p className="text-gray-400">No hay citas en atencion</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inProgress.map((a) => (
                  <div key={a.id} className="bg-white rounded-lg p-4 shadow border-l-4 border-yellow-400">
                    <p className="font-bold text-lg">{a.client_name}</p>
                    <p className="text-sm text-gray-500">Barbero: {a.barber_name}</p>
                    <p className="text-sm text-gray-500">Servicios: {a.services?.join(", ") || "-"}</p>
                    <button onClick={() => updateStatus(a.id, "completed")}
                      className="mt-3 w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                      Terminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Proximas Citas */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Proximas Citas</h2>
            {upcoming.length === 0 ? (
              <p className="text-gray-400">No hay proximas citas</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map((a) => (
                  <div key={a.id} className="bg-white rounded-lg p-4 shadow">
                    <div className="flex justify-between items-start">
                      <span className="text-lg font-bold text-indigo-600">{a.time}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[a.status]}`}>
                        {statusLabels[a.status]}
                      </span>
                    </div>
                    <p className="font-medium mt-1">{a.client_name}</p>
                    <p className="text-sm text-gray-500">Barbero: {a.barber_name}</p>
                    <p className="text-sm text-gray-500">Servicios: {a.services?.join(", ") || "-"}</p>
                    {a.client_phone && (
                      <p className="text-sm text-gray-400">Tel: {a.client_phone}</p>
                    )}
                    <div className="flex gap-2 mt-3">
                      {a.status === "pending" && (
                        <button onClick={() => updateStatus(a.id, "confirmed")}
                          className="flex-1 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200">
                          Confirmar
                        </button>
                      )}
                      {a.status === "confirmed" && (
                        <button onClick={() => updateStatus(a.id, "in_progress")}
                          className="flex-1 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200">
                          Iniciar
                        </button>
                      )}
                      <button onClick={() => updateStatus(a.id, "cancelled")}
                        className="flex-1 py-1 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Completadas Hoy */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Completadas Hoy</h2>
            {completed.length === 0 ? (
              <p className="text-gray-400">No hay citas completadas</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {completed.map((a) => (
                  <div key={a.id} className="bg-white rounded-lg px-4 py-2 shadow text-sm">
                    <span className="font-medium">{a.client_name}</span>
                    <span className="text-gray-400 ml-2">({a.barber_name})</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
