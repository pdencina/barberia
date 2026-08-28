"use client";

import { useState, useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import { useTenant } from "@/lib/tenant-context";
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
  const [blocks, setBlocks] = useState<Array<{ id: string; barber_id: string; date: string; all_day: boolean; start_time: string | null; end_time: string | null; reason: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const { tenant, loading: tenantLoading } = useTenant();

  // Get tenant ID (from context or localStorage override)
  const getActiveTenantId = () => {
    if (tenant?.id) return tenant.id;
    try {
      const stored = localStorage.getItem("tenant_override");
      if (stored) return JSON.parse(stored).tenantId;
    } catch {}
    return "";
  };

  // Columns to render: use the fetched barbers list; if it's empty (e.g. a barber
  // session where /api/barberos returned nothing) fall back to the barbers present
  // in today's appointments so the professional can still see and act on their citas.
  const displayBarbers: Barber[] = barbers.length > 0
    ? barbers
    : Array.from(
        new Map(
          appointments
            .filter((a) => a.barber_id && a.barber?.name)
            .map((a) => [a.barber_id, { id: a.barber_id, name: a.barber!.name }])
        ).values()
      );

  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [apptDetails, setApptDetails] = useState<any>(null);
  const [apptTab, setApptTab] = useState<"detalles" | "historial">("detalles");
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [editingApptTime, setEditingApptTime] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  const openApptDetails = async (apptId: string) => {
    setSelectedApptId(apptId);
    setApptTab("detalles");
    setEditingApptTime(false);
    setLoadingDetails(true);
    const res = await fetch(`/api/appointments/${apptId}/details`);
    const data = await res.json();
    setApptDetails(data);
    // Pre-fill edit form with current values
    setEditDate(data.date || "");
    setEditStartTime(data.start_time?.match(/(\d{2}:\d{2})/)?.[1] || "10:00");
    setEditEndTime(data.end_time?.match(/(\d{2}:\d{2})/)?.[1] || "11:00");
    setLoadingDetails(false);
  };

  const updateApptStatus = async (status: string) => {
    if (!selectedApptId) return;
    await fetch(`/api/appointments/${selectedApptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    showToast("Estado actualizado", "success");
    setSelectedApptId(null);
    await fetchAppointments();
  };

  // Drag-to-create state
  const [dragging, setDragging] = useState(false);
  const [dragBarberId, setDragBarberId] = useState<string | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragEndY, setDragEndY] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [popupTab, setPopupTab] = useState<"service" | "event">("service");
  const [popupData, setPopupData] = useState({ barberId: "", startTime: "", endTime: "", barberName: "" });
  const [dropIndicator, setDropIndicator] = useState<{ barberId: string; y: number } | null>(null);
  
  // Popup form
  const [selectedService, setSelectedService] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [popupPosition, setPopupPosition] = useState<"left" | "right">("right");

  const gridRef = useRef<HTMLDivElement>(null);

  // Fetch data
  useEffect(() => {
    if (tenantLoading) return;
    const t = getActiveTenantId();
    const params = t ? `?tenantId=${t}` : "";
    Promise.all([
      fetch(`/api/barberos${params}`).then((r) => r.json()),
      fetch(`/api/services${params}`).then((r) => r.json()),
      fetch(`/api/clients${params}`).then((r) => r.json()),
    ]).then(([b, s, c]) => {
      setBarbers(Array.isArray(b) ? b : []);
      setServices(Array.isArray(s) ? s : []);
      setClients(Array.isArray(c?.clients) ? c.clients : Array.isArray(c) ? c : []);
    }).catch(() => {
      setBarbers([]);
      setServices([]);
      setClients([]);
    });
  }, [tenant?.id, tenantLoading]);

  // Fetch appointments once tenant context is resolved — do NOT gate on barbers,
  // otherwise a barber with an empty/slow barbers list would spin forever.
  useEffect(() => {
    if (tenantLoading) return;
    fetchAppointments();
  }, [date, tenantLoading, tenant?.id]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const t = getActiveTenantId();
      const params = t ? `&tenantId=${t}` : "";
      const res = await fetch(`/api/appointments?date=${date}${params}`);
      const data = await res.json();
      // Filter out cancelled and no_show appointments
      setAppointments(Array.isArray(data) ? data.filter((a: any) => !["cancelled", "no_show"].includes(a.status)) : []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
    // Also refresh blocks
    setBlocksRefresh((n) => n + 1);
  };

  // Fetch blocks whenever the barber list, date, or refresh trigger changes
  const [blocksRefresh, setBlocksRefresh] = useState(0);
  useEffect(() => {
    if (barbers.length === 0) { setBlocks([]); return; }
    let cancelled = false;
    const month = date.slice(0, 7); // YYYY-MM
    Promise.all(
      barbers.map((b) =>
        fetch(`/api/barber/blocks?barberId=${b.id}&month=${month}`).then((r) => r.json()).catch(() => [])
      )
    ).then((results) => {
      if (cancelled) return;
      const allBlocks = results.flat();
      setBlocks(allBlocks.filter((bl: any) => bl.date === date));
    });
    return () => { cancelled = true; };
  }, [barbers, date, blocksRefresh]);

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
    // Don't start drag-to-create if clicking on an existing appointment
    if ((e.target as HTMLElement).closest("[data-appointment]")) return;
    // Only left click
    if (e.button !== 0) return;
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
    const barber = displayBarbers.find((b) => b.id === dragBarberId);

    // Calculate popup position: if barber is in the right half, show popup on left
    const barberIndex = displayBarbers.findIndex((b) => b.id === dragBarberId);
    const isRightSide = barberIndex >= displayBarbers.length / 2;
    setPopupPosition(isRightSide ? "left" : "right");

    setPopupData({
      barberId: dragBarberId,
      startTime,
      endTime,
      barberName: barber?.name || "",
    });
    setShowPopup(true);
    setPopupTab("service");
    // Auto-select the shortest service
    const shortest = services.length > 0 ? services.reduce((min, s) => s.duration < min.duration ? s : min, services[0]) : null;
    setSelectedService(shortest?.id || "");
    setSelectedClient("");
    setClientSearch("");
    setEventName("");
    setEventNotes("");
    setDragging(false);
  };

  // Touch handlers for mobile drag-to-create (long-press to activate)
  const touchRef = useRef<{ barberId: string; startY: number; startX: number; el: HTMLElement; activated: boolean } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Register non-passive touchmove to allow preventDefault when dragging
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;

    const onTouchMove = (e: TouchEvent) => {
      if (!touchRef.current) return;

      const touch = e.touches[0];

      // If not activated yet, check if finger moved too much (= scrolling, cancel)
      if (!touchRef.current.activated) {
        const dx = Math.abs(touch.clientX - touchRef.current.startX);
        const rect = touchRef.current.el.getBoundingClientRect();
        const dy = Math.abs(touch.clientY - rect.top - touchRef.current.startY);
        if (dx > 10 || dy > 15) {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          touchRef.current = null;
        }
        return; // Not activated, allow scroll
      }

      // Activated: BLOCK scroll and update drag
      e.preventDefault();
      e.stopPropagation();
      const rect = touchRef.current.el.getBoundingClientRect();
      const y = Math.max(0, touch.clientY - rect.top);
      setDragEndY(y);
    };

    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  });

  const handleTouchStart = (e: React.TouchEvent, barberId: string) => {
    if ((e.target as HTMLElement).closest("[data-appointment]")) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const y = touch.clientY - rect.top;
    touchRef.current = { barberId, startY: y, startX: touch.clientX, el: e.currentTarget as HTMLElement, activated: false };

    // Start long-press timer (400ms hold = activate create mode)
    longPressTimer.current = setTimeout(() => {
      if (!touchRef.current) return;
      touchRef.current.activated = true;
      setDragging(true);
      setDragBarberId(barberId);
      setDragStartY(y);
      setDragEndY(y);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 400);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (!touchRef.current || !touchRef.current.activated) {
      touchRef.current = null;
      setDragging(false);
      return;
    }
    handleMouseUp();
    touchRef.current = null;
  };

  // Create appointment from popup
  const handleCreate = async () => {
    setCreating(true);

    if (popupTab === "service") {
      if (!selectedService) { showToast("Selecciona un servicio", "error"); setCreating(false); return; }
      
      const startISO = `${date}T${popupData.startTime}:00`;
      const endISO = `${date}T${popupData.endTime}:00`;

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient || undefined,
          barberId: popupData.barberId,
          date,
          startTime: startISO,
          endTime: endISO,
          serviceIds: [selectedService],
          notes: eventNotes || undefined,
          tenantId: tenant?.id || getActiveTenantId(),
        }),
      });
      
      if (res.ok) {
        showToast("Cita creada", "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Error al crear cita", "error");
      }
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
    await fetchAppointments();
  };

  // Appointment block position - parse UTC time directly (avoid timezone shift)
  const getBlockStyle = (appt: Appointment) => {
    // Extract hours:minutes from the ISO string directly (stored as UTC = Chile time in this app)
    const startMatch = appt.start_time.match(/(\d{2}):(\d{2})/);
    const endMatch = appt.end_time.match(/(\d{2}):(\d{2})/);
    if (!startMatch || !endMatch) return { top: "0px", height: "24px" };
    
    const startMin = parseInt(startMatch[1]) * 60 + parseInt(startMatch[2]);
    const endMin = parseInt(endMatch[1]) * 60 + parseInt(endMatch[2]);
    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
    return { top: `${top}px`, height: `${Math.max(height, 24)}px` };
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);

  const searchClients = async (query: string) => {
    if (query.length < 2) { setFilteredClients([]); return; }
    const t = tenant?.id || "";
    const params = new URLSearchParams();
    if (t) params.set("tenantId", t);
    params.set("search", query);
    params.set("limit", "8");
    const res = await fetch(`/api/clients?${params.toString()}`);
    const data = await res.json();
    setFilteredClients(data.clients || []);
  };

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
              {displayBarbers.map((barber, i) => {
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
            <div className="relative flex" ref={(el) => { (gridRef as any).current = el; (gridContainerRef as any).current = el; }}>
              {/* Time labels */}
              <div className="w-14 flex-shrink-0 border-r border-gray-100">
                {hours.map((h) => (
                  <div key={h} className="h-16 flex items-start justify-end pr-1.5">
                    <span className="text-[10px] text-gray-400 -mt-1.5">{h.toString().padStart(2, "0")}:00</span>
                  </div>
                ))}
              </div>

              {/* Barber columns */}
              {displayBarbers.map((barber, bi) => {
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
                    onTouchStart={(e) => handleTouchStart(e, barber.id)}
                    onTouchEnd={handleTouchEnd}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; 
                      const rect = e.currentTarget.getBoundingClientRect();
                      setDropIndicator({ barberId: barber.id, y: e.clientY - rect.top });
                    }}
                    onDragLeave={() => setDropIndicator(null)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setDropIndicator(null);
                      const appointmentId = e.dataTransfer.getData("appointmentId");
                      if (!appointmentId) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = e.clientY - rect.top;
                      const newTime = yToTime(y);
                      const newStartISO = `${date}T${newTime}:00`;
                      // Assume 45min duration for moved appointment
                      const [h, m] = newTime.split(":").map(Number);
                      const endMin = h * 60 + m + 45;
                      const endH = Math.floor(endMin / 60);
                      const endM = endMin % 60;
                      const newEndISO = `${date}T${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}:00`;

                      await fetch(`/api/appointments/${appointmentId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          barber_id: barber.id,
                          start_time: newStartISO,
                          end_time: newEndISO,
                        }),
                      });
                      showToast("Cita movida", "success");
                      await fetchAppointments();
                    }}
                  >
                    {/* Hour grid lines */}
                    {hours.map((h) => (
                      <div key={h} className="h-16 border-b border-gray-50 hover:bg-gray-50/50" />
                    ))}

                    {/* Drop indicator - shows where block will land */}
                    {dropIndicator && dropIndicator.barberId === barber.id && (
                      <div
                        className="absolute left-1 right-1 h-12 bg-blue-500/20 border-2 border-blue-500 rounded-md pointer-events-none z-30 flex items-center justify-center"
                        style={{ top: `${Math.round(dropIndicator.y / HOUR_HEIGHT * 4) * (HOUR_HEIGHT / 4)}px` }}
                      >
                        <span className="text-[10px] text-blue-600 font-bold">
                          {yToTime(Math.round(dropIndicator.y / HOUR_HEIGHT * 4) * (HOUR_HEIGHT / 4))}
                        </span>
                      </div>
                    )}

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
                    {barberAppts.map((appt: any) => {
                      const sm = appt.start_time?.match(/(\d{2}):(\d{2})/);
                      const em = appt.end_time?.match(/(\d{2}):(\d{2})/);
                      const timeLabel = sm && em ? `${parseInt(sm[1])}:${sm[2]} – ${parseInt(em[1])}:${em[2]}` : "";
                      const eH = em ? parseInt(em[1]) : 0;
                      const eM = em ? parseInt(em[2]) : 0;
                      const sH = sm ? parseInt(sm[1]) : 0;
                      const sM = sm ? parseInt(sm[2]) : 0;
                      return (
                      <div
                        key={appt.id}
                        data-appointment="true"
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("appointmentId", appt.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openApptDetails(appt.id);
                        }}
                        className={`absolute left-1 right-1 rounded-md border-l-[3px] ${color.bg} ${color.border} ${color.text} px-1.5 py-1 overflow-hidden cursor-pointer hover:shadow-md hover:brightness-95 transition-all z-10 group`}
                        style={getBlockStyle(appt)}
                      >
                        <p className="text-[11px] font-bold truncate">{appt.client?.name || "Cliente"}</p>
                        <p className="text-[9px] truncate opacity-70">{appt.services?.map((s: any) => s.service?.name).join(", ")}</p>
                        <p className="text-[9px] opacity-50" data-timelabel>{timeLabel}</p>
                        {/* Resize handle */}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onMouseDown={(e) => {
                            e.stopPropagation(); e.preventDefault();
                            const startY = e.clientY;
                            const blockEl = e.currentTarget.parentElement!;
                            const origH = blockEl.offsetHeight;
                            const timeLabelEl = blockEl.querySelector("[data-timelabel]") as HTMLElement;
                            const onMove = (ev: MouseEvent) => {
                              const delta = ev.clientY - startY;
                              blockEl.style.height = `${Math.max(24, origH + delta)}px`;
                              // Update time label in real-time
                              if (timeLabelEl) {
                                const addMin = Math.round((delta / HOUR_HEIGHT) * 60 / 15) * 15;
                                const newEnd = eH * 60 + eM + addMin;
                                const nH = Math.floor(newEnd / 60), nM = newEnd % 60;
                                if (newEnd > sH * 60 + sM && newEnd <= END_HOUR * 60) {
                                  timeLabelEl.textContent = `${sH}:${sM.toString().padStart(2,"0")} – ${nH}:${nM.toString().padStart(2,"0")}`;
                                }
                              }
                            };
                            const onUp = async (ev: MouseEvent) => {
                              document.removeEventListener("mousemove", onMove);
                              document.removeEventListener("mouseup", onUp);
                              const addMin = Math.round(((ev.clientY - startY) / HOUR_HEIGHT) * 60 / 15) * 15;
                              const newEnd = eH * 60 + eM + addMin;
                              if (newEnd <= sH * 60 + sM || newEnd > END_HOUR * 60) { await fetchAppointments(); return; }
                              const nH = Math.floor(newEnd / 60), nM = newEnd % 60;
                              await fetch(`/api/appointments/${appt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ end_time: `${date}T${nH.toString().padStart(2,"0")}:${nM.toString().padStart(2,"0")}:00` }) });
                              showToast("Duracion actualizada", "success");
                              await fetchAppointments();
                            };
                            document.addEventListener("mousemove", onMove);
                            document.addEventListener("mouseup", onUp);
                          }}
                        ><div className="w-8 h-1 rounded-full bg-current opacity-40" /></div>
                      </div>
                      );
                    })}

                    {/* Schedule blocks */}
                    {blocks.filter((bl) => bl.barber_id === barber.id).map((block) => {
                      let top = 0, height = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
                      if (!block.all_day && block.start_time && block.end_time) {
                        const sm = block.start_time.match(/(\d{2}):(\d{2})/);
                        const em = block.end_time.match(/(\d{2}):(\d{2})/);
                        if (sm && em) {
                          const startMin = parseInt(sm[1]) * 60 + parseInt(sm[2]);
                          const endMin = parseInt(em[1]) * 60 + parseInt(em[2]);
                          top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                          height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                        }
                      }
                      return (
                        <div
                          key={block.id}
                          className="absolute left-1 right-1 rounded-md bg-gray-200/80 border border-gray-300 border-dashed px-1.5 py-1 overflow-hidden z-[5] group"
                          style={{ top: `${top}px`, height: `${Math.max(height, 24)}px` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            showToast(`Bloqueo: ${block.reason || "Sin motivo"}`, "info");
                          }}
                        >
                          <p className="text-[10px] font-medium text-gray-600 truncate">🚫 {block.reason || "Bloqueo"}</p>
                          {!block.all_day && block.start_time && block.end_time && (
                            <p className="text-[9px] text-gray-500">{block.start_time?.slice(0,5)} – {block.end_time?.slice(0,5)}</p>
                          )}
                          {block.all_day && <p className="text-[9px] text-gray-500">Todo el dia</p>}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await fetch(`/api/barber/blocks?id=${block.id}`, { method: "DELETE" });
                              showToast("Bloqueo eliminado", "success");
                              await fetchAppointments();
                            }}
                            className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] opacity-0 group-hover:opacity-100 flex items-center justify-center"
                          >✕</button>
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

      {/* Mobile FAB: Quick add appointment */}
      {!showPopup && (
        <button
          onClick={() => {
            const now = new Date();
            const h = now.getHours();
            const m = Math.ceil(now.getMinutes() / 15) * 15;
            const startTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
            const endM = h * 60 + m + 45;
            const endTime = `${Math.floor(endM / 60).toString().padStart(2, "0")}:${(endM % 60).toString().padStart(2, "0")}`;
            setPopupData({
              barberId: barbers[0]?.id || "",
              startTime,
              endTime,
              barberName: barbers[0]?.name || "",
            });
            setPopupPosition("right");
            setShowPopup(true);
            setPopupTab("service");
            const shortest = services.length > 0 ? services.reduce((min, s) => s.duration < min.duration ? s : min, services[0]) : null;
            setSelectedService(shortest?.id || "");
            setSelectedClient("");
            setClientSearch("");
            setEventName("");
            setEventNotes("");
          }}
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center text-2xl z-40 active:scale-95"
        >
          +
        </button>
      )}

      {/* Google Calendar style popup - positioned beside the selection */}
      {showPopup && (
        <div className="fixed inset-0 z-50" onClick={() => setShowPopup(false)}>
          <div
            className={`fixed top-20 bg-white rounded-2xl shadow-2xl border border-gray-200 w-[90vw] md:w-96 animate-scale-in max-h-[80vh] overflow-y-auto ${
              popupPosition === "left" ? "left-4 md:left-16" : "right-4 md:right-8"
            }`}
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
              {/* Time display - editable */}
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {new Date(date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <input type="time" value={popupData.startTime}
                  onChange={(e) => setPopupData({ ...popupData, startTime: e.target.value })}
                  className="border rounded-lg px-2 py-1 text-sm font-bold text-gray-900 w-24" />
                <span>–</span>
                <input type="time" value={popupData.endTime}
                  onChange={(e) => setPopupData({ ...popupData, endTime: e.target.value })}
                  className="border rounded-lg px-2 py-1 text-sm font-bold text-gray-900 w-24" />
              </div>

              {/* Barber */}
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <select
                  value={popupData.barberId}
                  onChange={(e) => {
                    const b = displayBarbers.find((br) => br.id === e.target.value);
                    setPopupData({ ...popupData, barberId: e.target.value, barberName: b?.name || "" });
                  }}
                  className="border rounded-lg px-2 py-1 text-sm font-medium text-gray-900"
                >
                  {displayBarbers.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
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
                      onChange={(e) => { setClientSearch(e.target.value); setSelectedClient(""); searchClients(e.target.value); }}
                      placeholder="Buscar cliente..."
                      className="w-full border rounded-xl px-3 py-2.5 text-sm" />
                    {clientSearch.length >= 2 && !selectedClient && filteredClients.length > 0 && (
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

      {/* Appointment Detail Popup */}
      {selectedApptId && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-20" onClick={() => setSelectedApptId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {loadingDetails ? (
              <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin mx-auto" /></div>
            ) : apptDetails ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-bold text-lg text-brand-dark">Cita</h3>
                  <div className="flex items-center gap-2">
                    <select value={apptDetails.status} onChange={(e) => updateApptStatus(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs font-medium">
                      <option value="scheduled">Pendiente</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="in_progress">En atencion</option>
                      <option value="completed">Completado</option>
                      <option value="no_show">No presentado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                    <button onClick={() => setSelectedApptId(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b px-4">
                  <button onClick={() => setApptTab("detalles")}
                    className={`pb-2 pt-3 px-3 text-sm font-medium border-b-2 ${apptTab === "detalles" ? "border-brand-blue text-brand-blue" : "border-transparent text-brand-gray"}`}>
                    Detalles
                  </button>
                  <button onClick={() => setApptTab("historial")}
                    className={`pb-2 pt-3 px-3 text-sm font-medium border-b-2 ${apptTab === "historial" ? "border-brand-blue text-brand-blue" : "border-transparent text-brand-gray"}`}>
                    Historial
                  </button>
                </div>

                {apptTab === "detalles" ? (
                  <div className="p-4 space-y-4">
                    {/* Service */}
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-brand-blue mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-brand-dark">{apptDetails.services?.map((s: any) => s.service?.name).join(" + ")}</p>
                        <p className="text-xs text-brand-gray mt-0.5">
                          Costo: {formatCurrency(apptDetails.services?.reduce((s: number, sv: any) => s + Number(sv.price || 0), 0) || 0)}
                          {" · "}Duracion: {apptDetails.services?.reduce((s: number, sv: any) => s + (sv.service?.duration || 0), 0)} min
                        </p>
                      </div>
                    </div>

                    {/* Date & Time */}
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-brand-gray flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm text-brand-dark font-medium">
                          {new Date(apptDetails.date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}
                          {"  "}
                          {apptDetails.start_time?.match(/(\d{2}:\d{2})/)?.[1] || ""}
                          {" – "}
                          {apptDetails.end_time?.match(/(\d{2}:\d{2})/)?.[1] || ""}
                        </p>
                      </div>
                    </div>

                    {/* Client */}
                    {apptDetails.client && (
                      <div className="flex items-start gap-3">
                        <svg className="w-4 h-4 text-brand-gray flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                        </svg>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-brand-dark">{apptDetails.client.name}</p>
                            {apptDetails.isNewClient && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded">NUEVO</span>
                            )}
                            {!apptDetails.isNewClient && apptDetails.totalVisits > 0 && (
                              <span className="text-[10px] text-brand-gray">{apptDetails.totalVisits} visitas</span>
                            )}
                          </div>
                          {apptDetails.client.email && <p className="text-xs text-brand-gray">{apptDetails.client.email}</p>}
                          {apptDetails.client.phone && <p className="text-xs text-brand-gray">{apptDetails.client.phone}</p>}
                        </div>
                      </div>
                    )}

                    {/* Barber */}
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-brand-gray flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25" />
                      </svg>
                      <p className="text-sm text-brand-dark">{apptDetails.barber?.name}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t">
                      <button onClick={() => setEditingApptTime(true)}
                        className="flex-1 py-2 border border-gray-200 rounded-xl text-xs text-brand-gray hover:bg-gray-50 font-medium">
                        Editar hora
                      </button>
                      <button onClick={() => updateApptStatus("cancelled")}
                        className="flex-1 py-2 border border-red-200 rounded-xl text-xs text-red-500 hover:bg-red-50 font-medium">
                        Cancelar cita
                      </button>
                    </div>

                    {/* Edit time/date form */}
                    {editingApptTime && (
                      <div className="mt-3 p-3 bg-brand-light rounded-xl space-y-3">
                        <p className="text-xs font-medium text-brand-dark">Modificar fecha y hora</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-brand-gray block mb-1">Fecha</label>
                            <input type="date" value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-brand-gray block mb-1">Inicio</label>
                            <input type="time" value={editStartTime}
                              onChange={(e) => setEditStartTime(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-brand-gray block mb-1">Fin</label>
                            <input type="time" value={editEndTime}
                              onChange={(e) => setEditEndTime(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingApptTime(false)}
                            className="flex-1 py-1.5 border border-gray-200 rounded-lg text-[11px] text-brand-gray hover:bg-white">
                            Cancelar
                          </button>
                          <button onClick={async () => {
                            await fetch(`/api/appointments/${selectedApptId}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                date: editDate,
                                start_time: `${editDate}T${editStartTime}:00`,
                                end_time: `${editDate}T${editEndTime}:00`,
                              }),
                            });
                            showToast("Cita reprogramada", "success");
                            setEditingApptTime(false);
                            setSelectedApptId(null);
                            await fetchAppointments();
                          }}
                            className="flex-1 py-1.5 bg-brand-blue text-white rounded-lg text-[11px] font-medium hover:opacity-90">
                            Guardar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {apptDetails.lastServices?.length > 0 ? (
                      <>
                        <p className="text-xs text-brand-gray font-medium uppercase">Ultimas visitas de {apptDetails.client?.name}</p>
                        {apptDetails.lastServices.map((svc: string, i: number) => (
                          <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                            <div className="w-6 h-6 rounded-full bg-brand-blue/10 flex items-center justify-center text-[10px] text-brand-blue font-bold">{i + 1}</div>
                            <p className="text-sm text-brand-dark">{svc || "—"}</p>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-sm text-brand-gray">Sin historial previo</p>
                        {apptDetails.isNewClient && <p className="text-xs text-green-600 mt-1">Cliente nuevo — primera visita!</p>}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
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
