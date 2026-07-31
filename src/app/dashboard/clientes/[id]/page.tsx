"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";

interface ClientData {
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    created_at: string;
  };
  stats: {
    totalSpent: number;
    totalVisits: number;
    totalNoShows: number;
    totalCancelled: number;
    attendanceRate: number;
    lastVisit: string | null;
    averageSpend: number;
    favoriteServices: Array<{ name: string; count: number }>;
    favoriteBarber: { name: string; visits: number } | null;
  };
  appointments: Array<{
    id: string;
    date: string;
    start_time: string;
    status: string;
    barber: { name: string } | null;
    services: Array<{ price: number; service: { name: string } }>;
  }>;
  transactions: Array<{
    id: string;
    total: number;
    payment_method: string;
    created_at: string;
    items: Array<{ description: string; total: number }>;
  }>;
}

const statusLabels: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  in_progress: "En Atencion",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No Asistio",
};

const statusColors: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-gray-100 text-gray-700",
};

const paymentLabels: Record<string, string> = {
  cash: "Efectivo",
  debit_card: "Debito",
  credit_card: "Credito",
  transfer: "Transferencia",
};

export default function ClienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Array<{ id: string; note: string; pinned: boolean; created_at: string; created_by_profile: { name: string } | null }>>([]);
  const [newNote, setNewNote] = useState("");
  const [pinNote, setPinNote] = useState(false);
  const [photos, setPhotos] = useState<Array<{ id: string; url: string; caption: string | null; created_at: string; barber: { name: string } | null }>>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/clients/${params.id}`)
        .then((r) => r.json())
        .then((d) => { if (d.client) setData(d); })
        .finally(() => setLoading(false));
      fetch(`/api/clients/${params.id}/notes`)
        .then((r) => r.json())
        .then((n) => setNotes(Array.isArray(n) ? n : []));
      fetch(`/api/clients/${params.id}/photos`)
        .then((r) => r.json())
        .then((p) => setPhotos(Array.isArray(p) ? p : []));
    }
  }, [params.id]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    await fetch(`/api/clients/${params.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: newNote, pinned: pinNote }),
    });
    setNewNote("");
    setPinNote(false);
    const res = await fetch(`/api/clients/${params.id}/notes`);
    setNotes(await res.json());
  };

  const deleteNote = async (noteId: string) => {
    await fetch(`/api/clients/${params.id}/notes?noteId=${noteId}`, { method: "DELETE" });
    setNotes(notes.filter((n) => n.id !== noteId));
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("caption", "");
    try {
      const res = await fetch(`/api/clients/${params.id}/photos`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const photosRes = await fetch(`/api/clients/${params.id}/photos`);
        setPhotos(await photosRes.json());
      }
    } catch (err) {
      console.error("Error subiendo foto:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const deletePhoto = async (photoId: string) => {
    await fetch(`/api/clients/${params.id}/photos?photoId=${photoId}`, { method: "DELETE" });
    setPhotos(photos.filter((p) => p.id !== photoId));
  };

  if (loading) return <Spinner />;
  if (!data) return <div className="p-6 text-center text-gray-500">Cliente no encontrado</div>;

  const { client, stats, appointments, transactions } = data;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Back button */}
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1">
        ← Volver a clientes
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600">
            {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
            <p className="text-sm text-gray-500">Cliente desde {new Date(client.created_at).toLocaleDateString("es-CL", { month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {client.phone && (
            <a href={`https://wa.me/${client.phone.replace(/\D/g, "")}`} target="_blank"
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-1">
              WhatsApp
            </a>
          )}
          {client.email && (
            <a href={`mailto:${client.email}`}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
              Email
            </a>
          )}
        </div>
      </div>

      {/* Contact info */}
      <div className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-400 text-xs uppercase">Email</p>
          <p className="font-medium">{client.email || "Sin email"}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase">Telefono</p>
          <p className="font-medium">{client.phone || "Sin telefono"}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase">Notas</p>
          <p className="font-medium">{client.notes || "Sin notas"}</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.totalVisits}</p>
          <p className="text-xs text-gray-500">Visitas</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalSpent)}</p>
          <p className="text-xs text-gray-500">Total Gastado</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.averageSpend)}</p>
          <p className="text-xs text-gray-500">Ticket Promedio</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className={`text-2xl font-bold ${stats.attendanceRate >= 80 ? "text-green-600" : stats.attendanceRate >= 50 ? "text-yellow-600" : "text-red-600"}`}>
            {stats.attendanceRate}%
          </p>
          <p className="text-xs text-gray-500">Asistencia</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{stats.totalNoShows}</p>
          <p className="text-xs text-gray-500">No Shows</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-lg font-bold text-gray-800">{stats.favoriteBarber?.name || "-"}</p>
          <p className="text-xs text-gray-500">Barbero Favorito</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-lg font-bold text-gray-800">
            {stats.lastVisit ? new Date(stats.lastVisit).toLocaleDateString("es-CL", { day: "numeric", month: "short" }) : "Nunca"}
          </p>
          <p className="text-xs text-gray-500">Ultima Visita</p>
        </div>
      </div>

      {/* Favorite services */}
      {stats.favoriteServices.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-gray-800 mb-3">Servicios Favoritos</h3>
          <div className="flex flex-wrap gap-2">
            {stats.favoriteServices.map((s) => (
              <span key={s.name} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">
                {s.name} <span className="text-blue-400">({s.count}x)</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Photos of cuts */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">Fotos de Cortes</h3>
            <p className="text-xs text-gray-400">Referencia visual del estilo del cliente</p>
          </div>
          <label className={`px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            {uploading ? "Subiendo..." : "📷 Subir Foto"}
            <input type="file" accept="image/*" capture="environment" onChange={uploadPhoto} className="hidden" />
          </label>
        </div>
        <div className="p-4">
          {photos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-4xl mb-2">📸</p>
              <p className="text-gray-400 text-sm">Sin fotos de cortes</p>
              <p className="text-gray-400 text-xs">Sube una foto despues de cada atencion para tener referencia</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.url}
                    alt={photo.caption || "Corte"}
                    onClick={() => setLightboxUrl(photo.url)}
                    className="w-full h-32 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent rounded-b-xl p-2">
                    <p className="text-[10px] text-white">
                      {new Date(photo.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                      {photo.barber?.name && ` · ${photo.barber.name}`}
                    </p>
                  </div>
                  <button
                    onClick={() => deletePhoto(photo.id)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Two columns: appointments & transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Internal Notes */}
        <div className="bg-white rounded-lg shadow lg:col-span-2">
          <div className="p-4 border-b">
            <h3 className="font-bold text-gray-800">Notas Internas</h3>
            <p className="text-xs text-gray-400">Preferencias y observaciones (solo visibles para el equipo)</p>
          </div>
          <div className="p-4">
            {/* Add note */}
            <div className="flex gap-2 mb-4">
              <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNote()}
                placeholder="Ej: Siempre pide fade bajo con linea..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={pinNote} onChange={(e) => setPinNote(e.target.checked)} className="rounded" />
                Fijar
              </label>
              <button onClick={addNote} disabled={!newNote.trim()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                Agregar
              </button>
            </div>
            {/* Notes list */}
            {notes.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Sin notas. Agrega preferencias del cliente aqui.</p>
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className={`flex items-start justify-between gap-3 p-3 rounded-lg ${n.pinned ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {n.pinned && <span className="text-yellow-500 text-xs">📌</span>}
                        <p className="text-sm text-gray-800">{n.note}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(n.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                        {n.created_by_profile && ` · ${n.created_by_profile.name}`}
                      </p>
                    </div>
                    <button onClick={() => deleteNote(n.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Appointments history */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-bold text-gray-800">Historial de Citas ({appointments.length})</h3>
          </div>
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {appointments.length === 0 ? (
              <p className="p-4 text-gray-400 text-center">Sin citas registradas</p>
            ) : appointments.map((appt: any) => (
              <div key={appt.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {new Date(appt.date).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[appt.status] || ""}`}>
                      {statusLabels[appt.status] || appt.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {appt.services?.map((s: any) => s.service?.name).join(", ")} · {appt.barber?.name}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(appt.start_time).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions history */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-bold text-gray-800">Historial de Compras ({transactions.length})</h3>
          </div>
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {transactions.length === 0 ? (
              <p className="p-4 text-gray-400 text-center">Sin compras registradas</p>
            ) : transactions.map((tx: any) => (
              <div key={tx.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {tx.items?.map((i: any) => i.description).join(", ") || "Venta"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(tx.created_at).toLocaleDateString("es-CL")} · {paymentLabels[tx.payment_method] || tx.payment_method}
                  </p>
                </div>
                <span className="text-sm font-bold text-green-600">{formatCurrency(Number(tx.total))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Corte" className="max-w-full max-h-[90vh] rounded-xl shadow-2xl" />
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300">✕</button>
        </div>
      )}
    </div>
  );
}
