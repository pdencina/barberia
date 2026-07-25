"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  active: boolean;
}

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", duration: "" });
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const fetchServices = async () => {
    setLoading(true);
    const res = await fetch("/api/services?all=true");
    const data = await res.json();
    setServices(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchServices(); }, []);

  const openNew = () => {
    setEditingService(null);
    setForm({ name: "", description: "", price: "", duration: "" });
    setShowModal(true);
  };

  const openEdit = (s: Service) => {
    setEditingService(s);
    setForm({
      name: s.name,
      description: s.description || "",
      price: String(s.price),
      duration: String(s.duration),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingService) {
      // Update
      await fetch(`/api/services/${editingService.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          price: parseInt(form.price),
          duration: parseInt(form.duration),
        }),
      });
      showToast("Servicio actualizado", "success");
    } else {
      // Create
      await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          price: parseInt(form.price),
          duration: parseInt(form.duration),
        }),
      });
      showToast("Servicio creado", "success");
    }

    setShowModal(false);
    fetchServices();
  };

  const toggleActive = async (s: Service) => {
    if (s.active) {
      const ok = await confirm({
        title: "Desactivar servicio",
        message: `Desactivar "${s.name}"? No aparecera en el booking ni POS.`,
        confirmText: "Desactivar",
        variant: "warning",
      });
      if (!ok) return;
    }

    await fetch(`/api/services/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    showToast(s.active ? "Servicio desactivado" : "Servicio activado", "success");
    fetchServices();
  };

  const activeServices = services.filter((s) => s.active);
  const inactiveServices = services.filter((s) => !s.active);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
          <p className="text-gray-500 text-sm">Gestiona el menu de servicios de tu barberia</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          Nuevo Servicio
        </button>
      </div>

      {/* Active services */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Servicios Activos ({activeServices.length})</h2>
        </div>
        {loading ? (
          <Spinner />
        ) : (
          <div className="divide-y">
            {activeServices.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-gray-900">{s.name}</p>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{s.duration} min</span>
                  </div>
                  {s.description && <p className="text-sm text-gray-500 mt-0.5">{s.description}</p>}
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(Number(s.price))}</p>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)}
                      className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-100">Editar</button>
                    <button onClick={() => toggleActive(s)}
                      className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Desactivar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inactive services */}
      {inactiveServices.length > 0 && (
        <div className="bg-white rounded-lg shadow opacity-75">
          <div className="p-4 border-b">
            <h2 className="font-bold text-gray-500">Inactivos ({inactiveServices.length})</h2>
          </div>
          <div className="divide-y">
            {inactiveServices.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-500 line-through">{s.name}</p>
                  <p className="text-sm text-gray-400">{s.duration} min · {formatCurrency(Number(s.price))}</p>
                </div>
                <button onClick={() => toggleActive(s)}
                  className="px-3 py-1.5 text-xs border border-green-200 text-green-600 rounded-lg hover:bg-green-50">
                  Reactivar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">
              {editingService ? "Editar Servicio" : "Nuevo Servicio"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Corte Clasico"
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion (opcional)</label>
                <input type="text" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Breve descripcion del servicio"
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio ($)</label>
                  <input type="number" required min="0" step="500" value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="8000"
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duracion (min)</label>
                  <input type="number" required min="5" step="5" value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    placeholder="30"
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit"
                  disabled={!form.name || !form.price || !form.duration}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {editingService ? "Guardar Cambios" : "Crear Servicio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
