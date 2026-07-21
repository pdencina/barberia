"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  client: { name: string; phone: string | null } | null;
  services: Array<{ price: number; service: { name: string; duration: number } }>;
}

interface Block {
  id: string;
  date: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

interface Barber {
  id: string;
  name: string;
}

const statusLabels: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  in_progress: "En Atencion",
  completed: "Completada",
};

const statusColors: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
};

export default function MiAgendaPage() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarber, setSelectedBarber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({
    date: new Date().toISOString().split("T")[0],
    allDay: true,
    startTime: "10:00",
    endTime: "21:00",
    reason: "",
  });
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    fetch("/api/barberos").then((r) => r.json()).then((data) => {
      const list = Array.isArray(data) ? data : [];
      setBarbers(list);
      if (list.length > 0) setSelectedBarber(list[0].id);
    });
  }, []);

  const fetchData = async () => {
    if (!selectedBarber) return;
    setLoading(true);
    const [apptRes, blockRes] = await Promise.all([
      fetch(`/api/barber/agenda?barberId=${selectedBarber}&date=${date}`),
      fetch(`/api/barber/blocks?barberId=${selectedBarber}&month=${date.slice(0, 7)}`),
    ]);
    setAppointments(await apptRes.json());
    setBlocks(await blockRes.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedBarber, date]);

  const changeDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    showToast("Estado actualizado", "success");
    fetchData();
  };

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/barber/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barberId: selectedBarber,
        date: blockForm.date,
        allDay: blockForm.allDay,
        startTime: blockForm.allDay ? null : blockForm.startTime,
        endTime: blockForm.allDay ? null : blockForm.endTime,
        reason: blockForm.reason,
      }),
    });
    showToast("Dia bloqueado", "success");
    setShowBlockModal(false);
    setBlockForm({ date: new Date().toISOString().split("T")[0], allDay: true, startTime: "10:00", endTime: "21:00", reason: "" });
    fetchData();
  };

  const removeBlock = async (id: string) => {
    const ok = await confirm({
      title: "Desbloquear",
      message: "Quieres eliminar este bloqueo?",
      confirmText: "Si, desbloquear",
      variant: "warning",
    });
    if (!ok) return;
    await fetch(`/api/barber/blocks?id=${id}`, { method: "DELETE" });
    showToast("Bloqueo eliminado", "success");
    fetchData();
  };

  const todayBlocks = blocks.filter((b) => b.date === date);
  const isBlockedToday = todayBlocks.some((b) => b.all_day);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">Mi Agenda</h1>
        <button
          onClick={() => setShowBlockModal(true)}
          className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
        >
          Bloquear Dia
        </button>
      </div>

      {/* Barber selector (for admin view) */}
      <select
        value={selectedBarber}
        onChange={(e) => setSelectedBarber(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      >
        {barbers.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>

      {/* Date navigation */}
      <div className="flex items-center justify-between bg-white rounded-lg p-3 shadow">
        <button onClick={() => changeDate(-1)} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-lg">←</button>
        <div className="text-center">
          <p className="font-bold">
            {new Date(date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-xs text-gray-500 border-none text-center" />
        </div>
        <button onClick={() => changeDate(1)} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-lg">→</button>
      </div>

      {/* Blocked day indicator */}
      {isBlockedToday && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="font-medium text-red-700">Dia bloqueado</p>
            <p className="text-sm text-red-500">{todayBlocks[0]?.reason || "Sin motivo"}</p>
          </div>
          <button
            onClick={() => removeBlock(todayBlocks[0].id)}
            className="text-xs text-red-600 border border-red-300 px-2 py-1 rounded hover:bg-red-100"
          >
            Desbloquear
          </button>
        </div>
      )}

      {/* Partial blocks */}
      {todayBlocks.filter((b) => !b.all_day).map((b) => (
        <div key={b.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="font-medium text-yellow-700">Bloqueado: {b.start_time} - {b.end_time}</p>
            <p className="text-sm text-yellow-500">{b.reason || "Sin motivo"}</p>
          </div>
          <button
            onClick={() => removeBlock(b.id)}
            className="text-xs text-yellow-600 border border-yellow-300 px-2 py-1 rounded hover:bg-yellow-100"
          >
            Quitar
          </button>
        </div>
      ))}

      {/* Appointments */}
      {loading ? (
        <Spinner />
      ) : appointments.length === 0 && !isBlockedToday ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">Sin citas para hoy</p>
          <p className="text-sm">Disfruta tu tiempo libre</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((a: any) => (
            <div key={a.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-indigo-600">
                      {new Date(a.start_time).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-xs text-gray-400">
                      - {new Date(a.end_time).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900">{a.client?.name || "Sin cliente"}</p>
                  {a.client?.phone && (
                    <a href={`tel:${a.client.phone}`} className="text-xs text-blue-500 hover:underline">
                      {a.client.phone}
                    </a>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    {a.services?.map((s: any) => s.service?.name).join(", ")}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[a.status] || ""}`}>
                  {statusLabels[a.status] || a.status}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                {a.status === "scheduled" && (
                  <button onClick={() => updateStatus(a.id, "confirmed")}
                    className="flex-1 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200">
                    Confirmar
                  </button>
                )}
                {a.status === "confirmed" && (
                  <button onClick={() => updateStatus(a.id, "in_progress")}
                    className="flex-1 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200">
                    Iniciar
                  </button>
                )}
                {a.status === "in_progress" && (
                  <button onClick={() => updateStatus(a.id, "completed")}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                    Completar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Bloquear Horario</h2>
            <form onSubmit={handleBlock} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input type="date" value={blockForm.date}
                  onChange={(e) => setBlockForm({ ...blockForm, date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" required />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="allDay" checked={blockForm.allDay}
                  onChange={(e) => setBlockForm({ ...blockForm, allDay: e.target.checked })}
                  className="rounded" />
                <label htmlFor="allDay" className="text-sm">Todo el dia</label>
              </div>
              {!blockForm.allDay && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Desde</label>
                    <input type="time" value={blockForm.startTime}
                      onChange={(e) => setBlockForm({ ...blockForm, startTime: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hasta</label>
                    <input type="time" value={blockForm.endTime}
                      onChange={(e) => setBlockForm({ ...blockForm, endTime: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                <input type="text" value={blockForm.reason}
                  onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  placeholder="Ej: Evento, dia libre, capacitacion..."
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowBlockModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Bloquear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
