"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  sku: string;
  cost: number;
  price: number;
  stock: number;
  min_stock: number;
}

interface Movement {
  id: string;
  type: string;
  quantity: number;
  notes: string;
  created_at: string;
  product: { name: string } | null;
  barber: { name: string } | null;
}

const movementTypeLabels: Record<string, string> = {
  in: "Entrada",
  out_use: "Uso",
  adjustment: "Ajuste",
};

export default function InventarioPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [productForm, setProductForm] = useState({
    name: "", sku: "", cost: "", price: "", stock: "", min_stock: "",
  });
  const [movementForm, setMovementForm] = useState({
    product_id: "", type: "in", quantity: "", notes: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, movementsRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/inventario/movements"),
      ]);
      const prodData = await productsRes.json();
      const movData = await movementsRes.json();
      setProducts(Array.isArray(prodData) ? prodData : []);
      setMovements(Array.isArray(movData) ? movData : []);
    } catch (err) {
      console.error("Error fetching inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const lowStockProducts = products.filter((p) => p.stock <= p.min_stock);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: productForm.name,
        sku: productForm.sku,
        cost: parseFloat(productForm.cost),
        price: parseFloat(productForm.price),
        stock: parseInt(productForm.stock),
        min_stock: parseInt(productForm.min_stock),
      }),
    });
    setShowProductModal(false);
    setProductForm({ name: "", sku: "", cost: "", price: "", stock: "", min_stock: "" });
    fetchData();
  };

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/inventario/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: movementForm.product_id,
        type: movementForm.type,
        quantity: parseInt(movementForm.quantity),
        notes: movementForm.notes,
      }),
    });
    setShowMovementModal(false);
    setMovementForm({ product_id: "", type: "in", quantity: "", notes: "" });
    fetchData();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMovementModal(true)}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900"
          >
            Registrar Movimiento
          </button>
          <button
            onClick={() => setShowProductModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 mb-2">Stock Bajo</h3>
          <div className="flex flex-wrap gap-2">
            {lowStockProducts.map((p) => (
              <span key={p.id} className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
                {p.name} ({p.stock}/{p.min_stock})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <h3 className="font-bold text-gray-800 p-4 border-b">Productos</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4 font-medium text-gray-600">Producto</th>
              <th className="text-left p-4 font-medium text-gray-600">SKU</th>
              <th className="text-right p-4 font-medium text-gray-600">Costo</th>
              <th className="text-right p-4 font-medium text-gray-600">Precio</th>
              <th className="text-center p-4 font-medium text-gray-600">Stock</th>
              <th className="text-center p-4 font-medium text-gray-600">Min</th>
              <th className="text-center p-4 font-medium text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="p-4 text-center text-gray-500">Cargando...</td></tr>
            ) : products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium">{p.name}</td>
                <td className="p-4 text-gray-500">{p.sku}</td>
                <td className="p-4 text-right">{formatCurrency(Number(p.cost))}</td>
                <td className="p-4 text-right">{formatCurrency(Number(p.price))}</td>
                <td className="p-4 text-center">{p.stock}</td>
                <td className="p-4 text-center">{p.min_stock}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    p.stock <= p.min_stock
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}>
                    {p.stock <= p.min_stock ? "Bajo" : "OK"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <h3 className="font-bold text-gray-800 p-4 border-b">Movimientos Recientes</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4 font-medium text-gray-600">Fecha</th>
              <th className="text-left p-4 font-medium text-gray-600">Producto</th>
              <th className="text-left p-4 font-medium text-gray-600">Tipo</th>
              <th className="text-center p-4 font-medium text-gray-600">Cantidad</th>
              <th className="text-left p-4 font-medium text-gray-600">Barbero</th>
              <th className="text-left p-4 font-medium text-gray-600">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {movements.map((m: any) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="p-4">{new Date(m.created_at).toLocaleDateString("es-CL")}</td>
                <td className="p-4">{m.product?.name || "-"}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    m.type === "in" ? "bg-green-100 text-green-700" :
                    m.type === "out_use" ? "bg-orange-100 text-orange-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {movementTypeLabels[m.type] || m.type}
                  </span>
                </td>
                <td className="p-4 text-center">{m.quantity}</td>
                <td className="p-4">{m.barber?.name || "-"}</td>
                <td className="p-4 text-gray-500">{m.notes || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Nuevo Producto</h2>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" required value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input type="text" value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo</label>
                  <input type="number" required min="0" value={productForm.cost}
                    onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                  <input type="number" required min="0" value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <input type="number" required min="0" value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Minimo</label>
                  <input type="number" required min="0" value={productForm.min_stock}
                    onChange={(e) => setProductForm({ ...productForm, min_stock: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Registrar Movimiento</h2>
            <form onSubmit={handleCreateMovement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
                <select required value={movementForm.product_id}
                  onChange={(e) => setMovementForm({ ...movementForm, product_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2">
                  <option value="">Seleccionar producto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select value={movementForm.type}
                  onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2">
                  <option value="in">Entrada</option>
                  <option value="out_use">Uso</option>
                  <option value="adjustment">Ajuste</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                <input type="number" required min="1" value={movementForm.quantity}
                  onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={movementForm.notes}
                  onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" rows={3} />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowMovementModal(false)}
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
