"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

interface Barber {
  id: string;
  name: string;
}

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  barber_id: string;
  client: { name: string; phone: string | null } | null;
  services: Array<{ service: { name: string } }>;
}

// Colors for barbers (rotating)
const barberColors = [
  { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-800" },
  { bg: "bg-purple-100", border: "border-purple-400", text: "text-purple-800" },
  { bg: "bg-green-100", border: "border-green-400", text: "text-green-800" },
  { bg: "bg-orange-100", border: "border-orange-400", text: "text-orange-800" },
  { bg: "bg-pink-100", border: "border-pink-400", text: "text-pink-800" },
  { bg: "bg-cyan-100", border: "border-cyan-400", text: "text-cyan-800" },
  { bg: "bg-yellow-100", border: "border-yellow-400", text: "text-yellow-800" },
  { bg: "bg-red-100", border: "border-red-400", text: "text-red-800" },
  { bg: "bg-indigo-100", border: "border-indigo-400", text: "text-indigo-800" },
];

const statusDot: Record<string, string> = {
  scheduled: "bg-yellow-500",
  confirmed: "bg-blue-500",
  in_progress: "bg-purple-500",
  completed: "bg-green-500",
};

export default function CalendarioPage() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [barbRes, apptRes] = await Promise.all([
      fetch("/api/barberos").then((r) => r.json()).catch(() => []),
      fetch(`/api/appointments?date=${date}`).then((r) => r.json()).catch(() => []),
    ]);
    setBarbers(Array.isArray(barbRes) ? barbRes : []);
    setAppointments(Array.isArray(apptRes) ? apptRes : []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [date]);

  const changeDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  };

  const goToday = () => setDate(new Date().toISOString().split("T")[0]);

  // Time slots from 9:00 to 21:00
  const hours: number[] = [];
  for (let h = 9; h <= 21; h++) hours.push(h);

  // Get appointments for a specific barber
  const getBarberAppointments = (barberId: string) => {
    return appointments.filter((a: any) => a.barber_id === barberId);
  };

  // Calculate position and height for an appointment block
  const getBlockStyle = (appt: Appointment) => {
    const start = new Date(appt.start_time);
    const end = new Date(appt.end_time);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const dayStartMinutes = 9 * 60; // 9:00 AM

    const top = ((startMinutes - dayStartMinutes) / 60) * 64; // 64px per hour
    const height = ((endMinutes - startMinutes) / 60) * 64;

    return { top: `${top}px`, height: `${Math.max(height, 28)}px` };
  };

  const isToday = date === new Date().toISOString().split("T")[0];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">←</button>
          <button onClick={goToday} className={`px-3 py-2 rounded-lg text-sm font-medium ${isToday ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}>
            Hoy
          </button>
          <button onClick={() => changeDate(1)} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">→</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm ml-2" />
        </div>
      </div>

      {/* Date display */}
      <div className="text-center">
        <p className="text-lg font-medium text-gray-700">
          {new Date(date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <p className="text-sm text-gray-400">{appointments.length} citas agendadas</p>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Barber headers */}
            <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="w-16 flex-shrink-0 p-2 border-r border-gray-100" />
              {barbers.map((barber, i) => {
                const color = barberColors[i % barberColors.length];
                return (
                  <div key={barber.id} className="flex-1 p-3 text-center border-r border-gray-100 min-w-[140px]">
                    <div className={`inline-block w-8 h-8 rounded-full ${color.bg} ${color.text} flex items-center justify-center text-xs font-bold mb-1`}>
                      {barber.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <p className="text-xs font-medium text-gray-700 truncate">{barber.name}</p>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="relative flex">
              {/* Time labels */}
              <div className="w-16 flex-shrink-0 border-r border-gray-100">
                {hours.map((h) => (
                  <div key={h} className="h-16 flex items-start justify-end pr-2 pt-0">
                    <span className="text-xs text-gray-400 -mt-2">
                      {h.toString().padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* Barber columns */}
              {barbers.map((barber, barberIndex) => {
                const barberAppts = getBarberAppointments(barber.id);
                const color = barberColors[barberIndex % barberColors.length];

                return (
                  <div key={barber.id} className="flex-1 relative border-r border-gray-50 min-w-[140px]">
                    {/* Hour lines */}
                    {hours.map((h) => (
                      <div key={h} className="h-16 border-b border-gray-50" />
                    ))}

                    {/* Appointment blocks */}
                    {barberAppts.map((appt: any) => {
                      const style = getBlockStyle(appt);
                      return (
                        <div
                          key={appt.id}
                          className={`absolute left-1 right-1 rounded-md border-l-3 ${color.bg} ${color.border} ${color.text} px-2 py-1 overflow-hidden cursor-pointer hover:shadow-md transition-shadow`}
                          style={style}
                          title={`${appt.client?.name || "Cliente"} - ${appt.services?.map((s: any) => s.service?.name).join(", ")}`}
                        >
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot[appt.status] || "bg-gray-400"}`} />
                            <p className="text-xs font-bold truncate">{appt.client?.name || "Cliente"}</p>
                          </div>
                          <p className="text-[10px] truncate opacity-75">
                            {appt.services?.map((s: any) => s.service?.name).join(", ")}
                          </p>
                          <p className="text-[10px] opacity-60">
                            {new Date(appt.start_time).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                            {" - "}
                            {new Date(appt.end_time).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Agendada</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Confirmada</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> En Atencion</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Completada</span>
      </div>
    </div>
  );
}
