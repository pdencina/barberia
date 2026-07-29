"use client";

import { useState, useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface Barber { id: string; name: string; }
interface Service { id: string; name: string; price: number; duration: number; }
interface Client { id: string; name: string; }

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
  scheduled: "bg-yellow-500", confirmed: "bg-blue-500", in_progress: "bg-purple-500", completed: "bg-green-500",
};

const HOUR_HEIGHT = 64; // px per hour
const START_HOUR = 9;
const END_HOUR = 21;

export default function CalendarioPage() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Drag-to-create state
  const [dragging, setDragging] = useState(false);
  const [dragBarberId, setDragBarberId] = useState<string | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragEndY, setDragEndY] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [popupTab, setPopupTab] = useState<"service" | "event">("service");
  const [popupData, setPopupData] = useState({ barberId: "", startTime: "", endTime: "", barberName: "" });
  
  // Popup form
  const [selectedService, setSelectedService] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

  // Fetch data
  useEffect(() => {
    Promise.all([
      fetch("/api/barberos").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()),
    ]).then(([b, s, c]) => {
      setBarbers(Array.isArray(b) ? b : []);
      setServices(Array.isArray(s) ? s : []);
      setClients(Array.isArray(c?.clients) ? c.clients : Array.isArray(c) ? c : []);
    });
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [date]);

  const fetchAppointments = async () => {
    setLoading(true);
    const res = await fetch(`/api/appointments?date=${date}`);
    const data = await res.json();
    setAppointments(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  // Navigation
  const changeDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  };
  const isToday = date === new Date().toISOString().split("T")[0];

  // Convert Y position to time
  const yToTime = (y: number): string => {
    const totalMinutes = START_HOUR * 60 + Math.round((y / HOUR_HEIGHT) * 60 / 15) * 15;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  const formatTime12 = (time24: string) => {
    const [h, m] = time24.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
  };

  // Mouse handlers for drag-to-create
  const handleMouseDown = (e: React.MouseEvent, barberId: string) => {
    if ((e.target as HTMLElement).closest("[data-appointment]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDragging(true);
    setDragBarberId(barberId);
    setDragStartY(y);
    setDragEndY(y);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDragEndY(Math.max(0, e.clientY - rect.top));
  };

  const handleMouseUp = () => {
    if (!dragging || !dragBarberId) { setDragging(false); return; }
    
    const minY = Math.min(dragStartY, dragEndY);
    const maxY = Math.max(dragStartY, dragEndY);
    
    // Minimum 15min (16px)
    if (maxY - minY < 10) { setDragging(false); return; }

    const startTime = yToTime(minY);
    const endTime = yToTime(maxY);
    const barber = barbers.find((b) => b.id === dragBarberId);

    setPopupData({
      barberId: dragBarberId,
      startTime,
      endTime,
      barberName: barber?.name || "",
    });
    setShowPopup(true);
    setPopupTab("service");
    setSelectedService("");
    setSelectedClient("");
    setClientSearch("");
    setEventName("");
    setEventNotes("");
    setDragging(false);
  };

  // Create appointment from popup
  const handleCreate = async () => {
    setCreating(true);

    if (popupTab === "service") {
      if (!selectedService) { showToast("Selecciona un servicio", "error"); setCreating(false); return; }
      
      const service = services.find((s) => s.id === selectedService);
      const startISO = `${date}T${popupData.startTime}:00`;
      const endISO = `${date}T${popupData.endTime}:00`;

      await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient || null,
          barberId: popupData.barberId,
          date,
          startTime: startISO,
          serviceIds: [selectedService],
          notes: eventNotes || null,
        }),
      });
      showToast("Cita creada", "success");
    } else {
      // Create block/event
      await fetch("/api/barber/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId: popupData.barberId,
          date,
          allDay: false,
          startTime: popupData.startTime,
          endTime: popupData.endTime,
          reason: eventName || "Bloqueo",
        }),
      });
      showToast("Bloqueo creado", "success");
    }

    setCreating(false);
    setShowPopup(false);
    fetchAppointments();
  };

  // Appointment block position
  const getBlockStyle = (appt: Appointment) => {
    const start = new Date(appt.start_time);
    const end = new Date(appt.end_time);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
    return { top: `${top}px`, height: `${Math.max(height, 24)}px` };
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const filteredClients = clientSearch
    ? clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Calendario</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">←</button>
          <button onClick={() => setDate(new Date().toISOString().split("T")[0])} className={`px-3 py-2 rounded-lg text-sm font-medium ${isToday ? "bg-blue-600 text-white" : "bg-gray-100"}`}>Hoy</button>
          <button onClick={() => changeDate(1)} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">→</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm ml-2" />
        </div>
      </div>

      <p className="text-center text-sm text-gray-600 font-medium">
        {new Date(date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
        <span className="text-gray-400 ml-2">· Click y arrastra para agendar</span>
      </p>

      {loading ? <Spinner /> : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Barber headers */}
            <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="w-14 flex-shrink-0 border-r border-gray-100" />
              {barbers.map((barber, i) => {
                const color = barberColors[i % barberColors.length];
                return (
                  <div key={barber.id} className="flex-1 p-2 text-center border-r border-gray-100 min-w-[120px]">
                    <div className={`inline-flex w-7 h-7 rounded-full ${color.bg} ${color.text} items-center justify-center text-[10px] font-bold`}>
                      {barber.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <p className="text-[11px] font-medium text-gray-700 truncate mt-0.5">{barber.name}</p>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="relative flex" ref={gridRef}>
              {/* Time labels */}
              <div className="w-14 flex-shrink-0 border-r border-gray-100">
                {hours.map((h) => (
                  <div key={h} className="h-16 flex items-start justify-end pr-1.5">
                    <span className="text-[10px] text-gray-400 -mt-1.5">{h.toString().padStart(2, "0")}:00</span>
                  </div>
                ))}
              </div>

              {/* Barber columns */}
              {barbers.map((barber, bi) => {
                const barberAppts = appointments.filter((a: any) => a.barber_id === barber.id);
                const color = barberColors[bi % barberColors.length];
                const isDragTarget = dragging && dragBarberId === barber.id;

                return (
                  <div
                    key={barber.id}
                    className="flex-1 relative border-r border-gray-50 min-w-[120px] select-none"
                    onMouseDown={(e) => handleMouseDown(e, barber.id)}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => { if (dragging) handleMouseUp(); }}
                  >
                    {/* Hour grid lines */}
                    {hours.map((h) => (
                      <div key={h} className="h-16 border-b border-gray-50 hover:bg-gray-50/50" />
                    ))}

                    {/* Drag selection preview (during drag) */}
                    {isDragTarget && !showPopup && (
                      <div
                        className="absolute left-1 right-1 bg-blue-500/20 border-2 border-blue-500 border-dashed rounded-md pointer-events-none z-20"
                        style={{
                          top: `${Math.min(dragStartY, dragEndY)}px`,
                          height: `${Math.abs(dragEndY - dragStartY)}px`,
                        }}
                      >
                        <span className="text-[10px] text-blue-600 font-medium p-1">
                          {formatTime12(yToTime(Math.min(dragStartY, dragEndY)))} - {formatTime12(yToTime(Math.max(dragStartY, dragEndY)))}
                        </span>
                      </div>
                    )}

                    {/* Solid block after selection (stays visible while popup is open) */}
                    {showPopup && popupData.barberId === barber.id && (
                      <div
                        className="absolute left-1 right-1 bg-blue-500 rounded-md z-20 shadow-lg shadow-blue-500/30"
                        style={{
                          top: `${((parseInt(popupData.startTime.split(":")[0]) * 60 + parseInt(popupData.startTime.split(":")[1])) - START_HOUR * 60) / 60 * HOUR_HEIGHT}px`,
                          height: `${((parseInt(popupData.endTime.split(":")[0]) * 60 + parseInt(popupData.endTime.split(":")[1])) - (parseInt(popupData.startTime.split(":")[0]) * 60 + parseInt(popupData.startTime.split(":")[1]))) / 60 * HOUR_HEIGHT}px`,
                        }}
                      >
                        <div className="p-1.5 text-white">
                          <p className="text-[10px] font-bold">(Sin titulo)</p>
                          <p className="text-[9px] opacity-80">{formatTime12(popupData.startTime)} – {formatTime12(popupData.endTime)}</p>
                        </div>
                      </div>
                    )}

                    {/* Appointment blocks */}
                    {barberAppts.map((appt: any) => (
                      <div
                        key={appt.id}
                        data-appointment="true"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("appointmentId", appt.id);
                        }}
                        className={`absolute left-1 right-1 rounded-md border-l-[3px] ${color.bg} ${color.border} ${color.text} px-1.5 py-1 overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow z-10`}
                        style={getBlockStyle(appt)}
                      >
                        <p className="text-[11px] font-bold truncate">{appt.client?.name || "Cliente"}</p>
                        <p className="text-[9px] truncate opacity-70">{appt.services?.map((s: any) => s.service?.name).join(", ")}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Google Calendar style popup - positioned beside the selection */}
      {showPopup && (
        <div className="fixed inset-0 z-50" onClick={() => setShowPopup(false)}>
          <div
            className="fixed top-16 left-4 md:left-auto md:right-8 md:top-24 bg-white rounded-2xl shadow-2xl border border-gray-200 w-[calc(100%-2rem)] md:w-96 animate-scale-in max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-lg">Cita</h3>
              <button onClick={() => setShowPopup(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 px-4 pt-3 border-b">
              <button onClick={() => setPopupTab("service")}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${popupTab === "service" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>
                Servicio
              </button>
              <button onClick={() => setPopupTab("event")}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${popupTab === "event" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>
                Evento / Bloqueo
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Time display */}
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {new Date(date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}
                  <span className="font-bold text-gray-900 ml-3">{formatTime12(popupData.startTime)}</span>
                  <span className="mx-2">–</span>
                  <span className="font-bold text-gray-900">{formatTime12(popupData.endTime)}</span>
                </span>
              </div>

              {/* Barber */}
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium text-gray-900">{popupData.barberName}</span>
              </div>

              {popupTab === "service" ? (
                <>
                  {/* Service selector */}
                  <div>
                    <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm">
                      <option value="">Seleccione un servicio</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} — {formatCurrency(Number(s.price))} ({s.duration}min)</option>
                      ))}
                    </select>
                  </div>

                  {/* Client search */}
                  <div className="relative">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Cliente</span>
                    </div>
                    <input type="text" value={clientSearch}
                      onChange={(e) => { setClientSearch(e.target.value); setSelectedClient(""); }}
                      placeholder="Buscar cliente..."
                      className="w-full border rounded-xl px-3 py-2.5 text-sm" />
                    {clientSearch && !selectedClient && filteredClients.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-32 overflow-y-auto">
                        {filteredClients.map((c) => (
                          <button key={c.id} onClick={() => { setSelectedClient(c.id); setClientSearch(c.name); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">{c.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Event name */}
                  <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)}
                    placeholder="Nombre del evento o bloqueo"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm" />
                </>
              )}

              {/* Notes */}
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-gray-400 mt-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <input type="text" value={eventNotes} onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="Notas (opcional)"
                  className="flex-1 border rounded-xl px-3 py-2.5 text-sm" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end p-4 border-t">
              <button onClick={handleCreate} disabled={creating || (popupTab === "service" && !selectedService)}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {creating ? "Creando..." : "Crear"}
              </button>
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
