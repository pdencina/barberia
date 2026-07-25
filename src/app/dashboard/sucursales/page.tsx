"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

interface Branch {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  open_time: string;
  close_time: string;
  active: boolean;
}

export default function SucursalesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", address: "", phone: "", email: "", open_time: "10:00", close_time: "21:00" });
  const { showToast } = useToast();

  const fetchBranches = async () => {
    setLoading(true);
    const res = await fetch("/api/branches");
    setBranches(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchBranches(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    showToast("Sucursal creada", "success");
    setShowModal(false);
    setForm({ name: "", slug: "", address: "", phone: "", email: "", open_time: "10:00", close_time: "21:00" });
    fetchBranches();
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://barberia-kappa-weld.vercel.app";

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sucursales</h1>
          <p className="text-gray-500 text-sm">Gestiona tus locales</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          Nueva Sucursal
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map((b) => (
            <div key={b.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{b.name}</h3>
                  <p className="text-sm text-gray-500">{b.address || "Sin direccion"}</p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Activa</span>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                {b.phone && <p>Tel: {b.phone}</p>}
                {b.email && <p>Email: {b.email}</p>}
                <p>Horario: {b.open_time} - {b.close_time}</p>
              </div>
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs text-gray-400 mb-1">Link de booking:</p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded text-blue-600 block truncate">
                  {appUrl}/booking?branch={b.slug}
                </code>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Como funciona Multi-Sucursal</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Cada sucursal tiene sus propios barberos, horarios y link de booking</li>
          <li>• Los reportes se pueden filtrar por sucursal</li>
          <li>• El inventario es independiente por local</li>
          <li>• Un admin puede ver todas las sucursales desde un solo dashboard</li>
        </ul>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Nueva Sucursal</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                  placeholder="Ej: EstudioLevels Santiago Centro"
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                <input type="text" required value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="santiago-centro"
                  className="w-full border rounded-lg px-3 py-2 font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
                <input type="text" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input type="text" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apertura</label>
                  <input type="time" value={form.open_time}
                    onChange={(e) => setForm({ ...form, open_time: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cierre</label>
                  <input type="time" value={form.close_time}
                    onChange={(e) => setForm({ ...form, close_time: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit"
                  disabled={!form.name || !form.slug}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  Crear Sucursal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
