"use client";

import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";

interface Barber { id: string; name: string; }

interface Appointment {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  barber_id: string;
  client: { name: string } | null;
  barber: { name: string } | null;
  services: Array<{ service: { name: string } }>;
}

const barberColors = [
  { bg: "bg-blue-100", border: "border-l-blue-500", text: "text-blue-800" },
  { bg: "bg-purple-100", border: "border-l-purple-500", text: "text-purple-800" },
  { bg: "bg-green-100", border: "border-l-green-500", text: "text-green-800" },
  { bg: "bg-orange-100", border: "border-l-orange-500", text: "text-orange-800" },
  { bg: "bg-pink-100", border: "border-l-pink-500", text: "text-pink-800" },
  { bg: "bg-cyan-100", border: "border-l-cyan-500", text: "text-cyan-800" },
  { bg: "bg-yellow-100", border: "border-l-yellow-500", text: "text-yellow-800" },
  { bg: "bg-red-100", border: "border-l-red-500", text: "text-red-800" },
  { bg: "bg-indigo-100", border: "border-l-indigo-500", text: "text-indigo-800" },
];

const statusDot: Record<string, string> = {
  scheduled: "bg-yellow-500",
  confirmed: "bg-blue-500",
  in_progress: "bg-purple-500",
  completed: "bg-green-500",
};

type ViewMode = "day" | "week";

export default function CalendarioPage() {
  const [view, setView] = useState<ViewMode>("day");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weekAppointments, setWeekAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Get Monday of the current week
  const getMonday = (d: string) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    return monday.toISOString().split("T")[0];
  };

  const [weekStart, setWeekStart] = useState(getMonday(date));

  // Generate week days
  const weekDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    weekDays.push(d.toISOString().split("T")[0]);
  }

  const fetchBarbers = async () => {
    const res = await fetch("/api/barberos");
    const data = await res.json();
    setBarbers(Array.isArray(data) ? data : []);
  };

  const fetchDayAppointments = async () => {
    setLoading(true);
    const res = await fetch(`/api/appointments?date=${date}`);
    const data = await res.json();
    setAppointments(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const fetchWeekAppointments = async () => {
    setLoading(true);
    const res = await fetch(`/api/appointments/week?start=${weekStart}`);
    const data = await res.json();
    setWeekAppointments(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchBarbers(); }, []);
  useEffect(() => { if (view === "day") fetchDayAppointments(); }, [date, view]);
  useEffect(() => { if (view === "week") fetchWeekAppointments(); }, [weekStart, view]);

  const changeDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  };

  const changeWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + (delta * 7));
    setWeekStart(d.toISOString().split("T")[0]);
  };

  const goToday = () => {
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
    setWeekStart(getMonday(today));
  };

  const isToday = (d: string) => d === new Date().toISOString().split("T")[0];

  // Hours for day view
  const hours: number[] = [];
  for (let h = 9; h <= 21; h++) hours.push(h);

  // Get block position for day view
  const getBlockStyle = (appt: Appointment) => {
    const start = new Date(appt.start_time);
    const end = new Date(appt.end_time);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const top = ((startMin - 540) / 60) * 64;
    const height = ((endMin - startMin) / 60) * 64;
    return { top: `${top}px`, height: `${Math.max(height, 28)}px` };
  };

  // Barber color by index
  const getBarberColor = (barberId: string) => {
    const idx = barbers.findIndex((b) => b.id === barberId);
    return barberColors[idx >= 0 ? idx % barberColors.length : 0];
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Calendario</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setView("day")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "day" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
              Dia
            </button>
            <button onClick={() => setView("week")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "week" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
              Semana
            </button>
          </div>
          {/* Navigation */}
          <button onClick={() => view === "day" ? changeDate(-1) : changeWeek(-1)} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">←</button>
          <button onClick={goToday} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Hoy</button>
          <button onClick={() => view === "day" ? changeDate(1) : changeWeek(1)} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">→</button>
        </div>
      </div>

      {/* Date display */}
      <p className="text-center text-gray-600 font-medium">
        {view === "day"
          ? new Date(date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          : `${new Date(weekDays[0] + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })} — ${new Date(weekDays[6] + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}`
        }
      </p>

      {loading ? <Spinner /> : view === "day" ? (
        /* ===== DAY VIEW ===== */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Barber headers */}
            <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="w-16 flex-shrink-0 p-2 border-r border-gray-100" />
              {barbers.map((barber, i) => {
                const color = barberColors[i % barberColors.length];
                return (
                  <div key={barber.id} className="flex-1 p-3 text-center border-r border-gray-100 min-w-[120px]">
                    <div className={`inline-flex w-8 h-8 rounded-full ${color.bg} ${color.text} items-center justify-center text-xs font-bold mb-1`}>
                      {barber.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <p className="text-xs font-medium text-gray-700 truncate">{barber.name}</p>
                  </div>
                );
              })}
            </div>
            {/* Time grid */}
            <div className="relative flex">
              <div className="w-16 flex-shrink-0 border-r border-gray-100">
                {hours.map((h) => (
                  <div key={h} className="h-16 flex items-start justify-end pr-2">
                    <span className="text-xs text-gray-400 -mt-2">{h.toString().padStart(2, "0")}:00</span>
                  </div>
                ))}
              </div>
              {barbers.map((barber, bi) => {
                const barberAppts = appointments.filter((a: any) => a.barber_id === barber.id);
                const color = barberColors[bi % barberColors.length];
                return (
                  <div key={barber.id} className="flex-1 relative border-r border-gray-50 min-w-[120px]">
                    {hours.map((h) => <div key={h} className="h-16 border-b border-gray-50" />)}
                    {barberAppts.map((appt: any) => (
                      <div key={appt.id} className={`absolute left-1 right-1 rounded-md border-l-3 ${color.bg} ${color.border} ${color.text} px-2 py-1 overflow-hidden`} style={getBlockStyle(appt)}>
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${statusDot[appt.status] || "bg-gray-400"}`} />
                          <p className="text-[11px] font-bold truncate">{appt.client?.name || "Cliente"}</p>
                        </div>
                        <p className="text-[10px] truncate opacity-75">{appt.services?.map((s: any) => s.service?.name).join(", ")}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ===== WEEK VIEW ===== */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 sticky top-0 bg-white z-10">
              {weekDays.map((d) => {
                const dayObj = new Date(d + "T12:00:00");
                const today = isToday(d);
                return (
                  <div key={d} className={`p-3 text-center border-r border-gray-100 ${today ? "bg-blue-50" : ""}`}>
                    <p className="text-xs text-gray-500 uppercase">{dayObj.toLocaleDateString("es-CL", { weekday: "short" })}</p>
                    <p className={`text-lg font-bold ${today ? "text-blue-600" : "text-gray-900"}`}>{dayObj.getDate()}</p>
                  </div>
                );
              })}
            </div>
            {/* Appointments per day */}
            <div className="grid grid-cols-7 min-h-[500px]">
              {weekDays.map((d) => {
                const dayAppts = weekAppointments.filter((a) => a.date === d);
                const today = isToday(d);
                return (
                  <div key={d} className={`border-r border-gray-50 p-1 ${today ? "bg-blue-50/30" : ""}`}>
                    {dayAppts.length === 0 ? (
                      <p className="text-center text-xs text-gray-300 mt-4">-</p>
                    ) : (
                      <div className="space-y-1">
                        {dayAppts.map((appt: any) => {
                          const color = getBarberColor(appt.barber_id);
                          return (
                            <div key={appt.id} className={`rounded p-1.5 border-l-2 ${color.bg} ${color.border}`}>
                              <p className="text-[10px] font-bold text-gray-800 truncate">
                                {new Date(appt.start_time).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                              <p className="text-[10px] text-gray-600 truncate">{appt.client?.name}</p>
                              <p className="text-[9px] text-gray-400 truncate">{appt.barber?.name}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
