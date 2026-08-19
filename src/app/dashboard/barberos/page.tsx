"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { useTenant } from "@/lib/tenant-context";
import { Spinner } from "@/components/ui/spinner";

interface Barber {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
}

export default function BarberosPage() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", password: "" });
  const { showToast } = useToast();
  const { tenant } = useTenant();

  const fetchBarbers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/barberos");
      const data = await res.json();
      setBarbers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching barbers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBarbers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/barberos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, tenantId: tenant?.id }),
    });
    showToast("Profesional creado. Se envio email con credenciales.", "success");
    setShowModal(false);
    setFormData({ name: "", email: "", phone: "", password: "" });
    fetchBarbers();
  };

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  const generateInviteCode = async () => {
    if (!tenant?.id) {
      showToast("Error: no se pudo obtener el negocio. Recarga la pagina.", "error");
      return;
    }
    setGeneratingCode(true);
    try {
      const res = await fetch("/api/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      const data = await res.json();
      if (data.code) {
        setInviteCode(data.code);
        showToast("Codigo generado", "success");
      } else {
        showToast(data.error || "Error al generar codigo", "error");
      }
    } catch (err) {
      showToast("Error de conexion", "error");
    }
    setGeneratingCode(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Profesionales</h1>
        <button onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          Nuevo Profesional
        </button>
      </div>

      {/* Invite Code */}
      <div className="bg-gradient-to-r from-brand-blue/5 to-brand-accent/5 rounded-2xl border border-brand-blue/20 p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-brand-dark">Codigo de invitacion</p>
          <p className="text-xs text-brand-gray">Comparte este codigo para que un profesional se una a tu negocio al registrarse.</p>
        </div>
        {inviteCode ? (
          <div className="flex items-center gap-2">
            <span className="px-4 py-2 bg-white border border-gray-200 rounded-xl font-mono text-lg font-bold text-brand-dark tracking-widest">{inviteCode}</span>
            <button onClick={() => { navigator.clipboard.writeText(inviteCode); showToast("Codigo copiado!", "success"); }}
              className="px-3 py-2 bg-brand-blue text-white text-xs rounded-xl hover:bg-brand-blue/90">Copiar</button>
          </div>
        ) : (
          <button onClick={generateInviteCode} disabled={generatingCode || !tenant?.id}
            className="px-4 py-2 bg-brand-blue text-white text-sm rounded-xl hover:bg-brand-blue/90 disabled:opacity-50 whitespace-nowrap">
            {generatingCode ? "Generando..." : !tenant?.id ? "Cargando..." : "Generar codigo"}
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4 font-medium text-gray-600">Nombre</th>
              <th className="text-left p-4 font-medium text-gray-600">Email</th>
              <th className="text-left p-4 font-medium text-gray-600">Telefono</th>
              <th className="text-right p-4 font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={4}><Spinner /></td></tr>
            ) : barbers.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center text-gray-500">No hay profesionales</td></tr>
            ) : barbers.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium text-blue-600 cursor-pointer" onClick={() => window.location.href = `/dashboard/barberos/${b.id}`}>
                  <div className="flex items-center gap-3">
                    {b.avatar_url ? (
                      <img src={b.avatar_url} alt={b.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                        {b.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                    )}
                    {b.name}
                  </div>
                </td>
                <td className="p-4">{b.email || "-"}</td>
                <td className="p-4">{b.phone || "-"}</td>
                <td className="p-4 text-right">
                  <button onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Desactivar a "${b.name}"? Ya no aparecera en agenda ni booking.`)) return;
                    await fetch(`/api/barberos/${b.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ active: false }),
                    });
                    showToast("Profesional desactivado", "success");
                    fetchBarbers();
                  }} className="px-3 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-modal flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 md:p-6 w-full max-w-md shadow-xl animate-scale-in">
            <h2 className="text-lg font-bold mb-4">Nuevo Profesional</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" required value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" required value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                <input type="text" value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena</label>
                <input type="password" required value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit"
                  disabled={!formData.name.trim() || !formData.email.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
