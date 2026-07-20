"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface Coupon {
  id: string;
  code: string;
  description: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_purchase: number | null;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
  active: boolean;
}

export default function CuponesPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    code: "", description: "", type: "percentage", value: "",
    min_purchase: "", max_uses: "", valid_until: "",
  });

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cupones");
      setCoupons(await res.json());
    } catch (err) {
      console.error("Error fetching coupons:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCoupons(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/cupones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: formData.code,
        description: formData.description,
        discountType: formData.type,
        discountValue: parseFloat(formData.value),
        minPurchase: parseFloat(formData.min_purchase) || null,
        maxUses: parseInt(formData.max_uses) || null,
        validUntil: formData.valid_until || null,
      }),
    });
    setShowModal(false);
    setFormData({ code: "", description: "", type: "percentage", value: "", min_purchase: "", max_uses: "", valid_until: "" });
    fetchCoupons();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Cupones</h1>
        <button onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          Nuevo Cupon
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4 font-medium text-gray-600">Codigo</th>
              <th className="text-left p-4 font-medium text-gray-600">Descripcion</th>
              <th className="text-left p-4 font-medium text-gray-600">Descuento</th>
              <th className="text-right p-4 font-medium text-gray-600">Min Compra</th>
              <th className="text-center p-4 font-medium text-gray-600">Usos</th>
              <th className="text-left p-4 font-medium text-gray-600">Valido Hasta</th>
              <th className="text-center p-4 font-medium text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="p-4 text-center text-gray-500">Cargando...</td></tr>
            ) : coupons.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-gray-500">No hay cupones</td></tr>
            ) : coupons.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="p-4 font-mono font-medium">{c.code}</td>
                <td className="p-4">{c.description || "-"}</td>
                <td className="p-4">
                  {c.discount_type === "percentage" ? `${c.discount_value}%` : formatCurrency(Number(c.discount_value))}
                </td>
                <td className="p-4 text-right">{c.min_purchase ? formatCurrency(Number(c.min_purchase)) : "-"}</td>
                <td className="p-4 text-center">{c.used_count}/{c.max_uses || "∞"}</td>
                <td className="p-4">
                  {c.valid_until ? new Date(c.valid_until).toLocaleDateString("es-CL") : "Sin limite"}
                </td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    c.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {c.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Nuevo Cupon</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Codigo</label>
                <input type="text" required value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full border rounded-lg px-3 py-2 font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <input type="text" value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2">
                    <option value="percentage">Porcentaje</option>
                    <option value="fixed_amount">Monto Fijo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                  <input type="number" required min="0" value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Compra Minima</label>
                  <input type="number" min="0" value={formData.min_purchase}
                    onChange={(e) => setFormData({ ...formData, min_purchase: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usos Maximos</label>
                  <input type="number" min="1" value={formData.max_uses}
                    onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valido Hasta</label>
                <input type="date" value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
