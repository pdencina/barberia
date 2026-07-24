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

  useEffect(() => {
    if (params.id) {
      fetch(`/api/clients/${params.id}`)
        .then((r) => r.json())
        .then((d) => { if (d.client) setData(d); })
        .finally(() => setLoading(false));
    }
  }, [params.id]);

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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

      {/* Two columns: appointments & transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
    </div>
  );
}
