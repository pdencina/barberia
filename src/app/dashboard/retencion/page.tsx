"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

interface InactiveClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lastVisit: string | null;
  totalVisits: number;
  daysSinceVisit: number;
}

export default function RetencionPage() {
  const [clients, setClients] = useState<InactiveClient[]>([]);
  const [stats, setStats] = useState({ total: 0, inactive: 0, percentage: 0 });
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<Array<{ code: string; description: string }>>([]);
  const [selectedCoupon, setSelectedCoupon] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [retRes, coupRes] = await Promise.all([
      fetch(`/api/retention?days=${days}`),
      fetch("/api/cupones"),
    ]);
    const retData = await retRes.json();
    const coupData = await coupRes.json();
    setClients(retData.clients || []);
    setStats(retData.stats || { total: 0, inactive: 0, percentage: 0 });
    setCoupons(Array.isArray(coupData) ? coupData : []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [days]);

  const notifyClient = async (clientId: string, type: "email" | "whatsapp") => {
    setSendingId(`${clientId}-${type}`);
    const res = await fetch("/api/retention/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        type,
        couponCode: selectedCoupon || null,
        message: customMessage || null,
      }),
    });
    const data = await res.json();
    setSendingId(null);

    if (data.success) {
      if (type === "whatsapp" && data.url) {
        window.open(data.url, "_blank");
        showToast("WhatsApp abierto", "success");
      } else {
        showToast("Email enviado", "success");
      }
    } else {
      showToast(data.error || "Error al notificar", "error");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Retencion de Clientes</h1>
          <p className="text-gray-500 text-sm">Recupera clientes que no han vuelto</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Total Clientes</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-yellow-500">
          <p className="text-sm text-gray-500">Inactivos (+{days} dias)</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.inactive}</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-red-500">
          <p className="text-sm text-gray-500">% Inactivos</p>
          <p className="text-2xl font-bold text-red-600">{stats.percentage}%</p>
        </div>
      </div>

      {/* Filters & Config */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dias sin visita</label>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value={15}>15 dias</option>
              <option value={30}>30 dias</option>
              <option value={45}>45 dias</option>
              <option value={60}>60 dias</option>
              <option value={90}>90 dias</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cupon a incluir</label>
            <select
              value={selectedCoupon}
              onChange={(e) => setSelectedCoupon(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Sin cupon</option>
              {coupons.map((c: any) => (
                <option key={c.code} value={c.code}>{c.code} - {c.description}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Mensaje personalizado</label>
            <input
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Te extrañamos! Vuelve a EstudioLevels..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Clients list */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4 font-medium text-gray-600">Cliente</th>
              <th className="text-left p-4 font-medium text-gray-600">Contacto</th>
              <th className="text-center p-4 font-medium text-gray-600">Visitas</th>
              <th className="text-center p-4 font-medium text-gray-600">Ultima Visita</th>
              <th className="text-center p-4 font-medium text-gray-600">Dias Inactivo</th>
              <th className="text-center p-4 font-medium text-gray-600">Notificar</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6}><Spinner /></td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-gray-500">No hay clientes inactivos. Todos al dia!</td></tr>
            ) : clients.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium">{c.name}</td>
                <td className="p-4">
                  <div className="text-xs text-gray-500">
                    {c.email && <p>{c.email}</p>}
                    {c.phone && <p>{c.phone}</p>}
                  </div>
                </td>
                <td className="p-4 text-center">{c.totalVisits}</td>
                <td className="p-4 text-center text-gray-500">
                  {c.lastVisit ? new Date(c.lastVisit).toLocaleDateString("es-CL") : "Nunca"}
                </td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    c.daysSinceVisit >= 60 ? "bg-red-100 text-red-700" :
                    c.daysSinceVisit >= 30 ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {c.daysSinceVisit} dias
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex gap-2 justify-center">
                    {c.phone && (
                      <button
                        onClick={() => notifyClient(c.id, "whatsapp")}
                        disabled={sendingId === `${c.id}-whatsapp`}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WhatsApp
                      </button>
                    )}
                    {c.email && (
                      <button
                        onClick={() => notifyClient(c.id, "email")}
                        disabled={sendingId === `${c.id}-email`}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {sendingId === `${c.id}-email` ? "..." : "Email"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
