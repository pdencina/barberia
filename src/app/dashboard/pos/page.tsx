"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface Client {
  id: string;
  name: string;
}

interface Barber {
  id: string;
  name: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  type: "service" | "product";
}

export default function POSPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [activeTab, setActiveTab] = useState<"services" | "products">("services");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBarber, setSelectedBarber] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/barberos").then((r) => r.json()),
    ]).then(([servicesData, productsData, clientsData, barbersData]) => {
      setServices(servicesData);
      setProducts(productsData);
      setClients(clientsData.clients || clientsData || []);
      setBarbers(barbersData);
    });
  }, []);

  const filteredItems =
    activeTab === "services"
      ? services.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
      : products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const addToCart = (item: Service | Product, type: "service" | "product") => {
    const existing = cart.find((c) => c.id === item.id && c.type === type);
    if (existing) {
      setCart(cart.map((c) => (c.id === item.id && c.type === type ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { id: item.id, name: item.name, price: item.price, quantity: 1, type }]);
    }
  };

  const updateQuantity = (id: string, type: string, delta: number) => {
    setCart(
      cart
        .map((c) => (c.id === id && c.type === type ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const updatePrice = (id: string, type: string, price: number) => {
    setCart(cart.map((c) => (c.id === id && c.type === type ? { ...c, price } : c)));
  };

  const removeFromCart = (id: string, type: string) => {
    setCart(cart.filter((c) => !(c.id === id && c.type === type)));
  };

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const total = subtotal - discount;

  const applyCoupon = async () => {
    setCouponError("");
    if (!couponCode) return;
    try {
      const res = await fetch(`/api/cupones/validate?code=${couponCode}&amount=${subtotal}`);
      const data = await res.json();
      if (res.ok) {
        setDiscount(data.discount);
      } else {
        setCouponError(data.error || "Cupon invalido");
        setDiscount(0);
      }
    } catch {
      setCouponError("Error al validar cupon");
    }
  };

  const handleCheckout = async () => {
    if (!selectedBarber || cart.length === 0 || !paymentMethod) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId: selectedBarber,
          clientId: selectedClient || null,
          items: cart,
          paymentMethod,
          couponCode: couponCode || null,
          discount,
          subtotal,
          total,
        }),
      });
      if (res.ok) {
        setCart([]);
        setDiscount(0);
        setCouponCode("");
        setPaymentMethod("");
        setSelectedClient("");
        alert("Venta registrada exitosamente");
      }
    } catch (err) {
      console.error("Error en checkout:", err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left: Items */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setActiveTab("services")}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === "services" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            Servicios
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === "products" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            Productos
          </button>
        </div>

        <input
          type="text"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 mb-4"
        />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => addToCart(item, activeTab === "services" ? "service" : "product")}
              className="bg-white p-4 rounded-lg shadow hover:shadow-md transition text-left"
            >
              <p className="font-medium text-gray-900">{item.name}</p>
              <p className="text-indigo-600 font-bold">{formatCurrency(item.price)}</p>
              <p className="text-xs text-gray-500">
                {activeTab === "services"
                  ? `${(item as Service).duration} min`
                  : `Stock: ${(item as Product).stock}`}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-96 bg-white border-l flex flex-col">
        <div className="p-4 border-b space-y-3">
          <h2 className="font-bold text-lg">Venta</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Barbero *</label>
            <select
              value={selectedBarber}
              onChange={(e) => setSelectedBarber(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              required
            >
              <option value="">Seleccionar barbero</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Sin cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Agrega items a la venta</p>
          ) : (
            cart.map((item) => (
              <div key={`${item.type}-${item.id}`} className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-sm">{item.name}</p>
                  <button
                    onClick={() => removeFromCart(item.id, item.type)}
                    className="text-red-500 text-xs hover:text-red-700"
                  >
                    Quitar
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.type, -1)}
                    className="w-7 h-7 rounded bg-gray-200 text-gray-700 flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.type, 1)}
                    className="w-7 h-7 rounded bg-gray-200 text-gray-700 flex items-center justify-center"
                  >
                    +
                  </button>
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => updatePrice(item.id, item.type, parseFloat(e.target.value) || 0)}
                    className="w-24 border rounded px-2 py-1 text-sm text-right ml-auto"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t p-4 space-y-3">
          {/* Coupon */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Codigo cupon"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={applyCoupon}
              className="px-3 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900"
            >
              Aplicar
            </button>
          </div>
          {couponError && <p className="text-red-500 text-xs">{couponError}</p>}

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Descuento</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-1 border-t">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "cash", label: "Efectivo" },
              { key: "debit_card", label: "Debito" },
              { key: "credit_card", label: "Credito" },
              { key: "transfer", label: "Transfer" },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => setPaymentMethod(m.key)}
                className={`py-2 rounded-lg text-sm font-medium ${
                  paymentMethod === m.key
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleCheckout}
            disabled={!selectedBarber || cart.length === 0 || !paymentMethod || processing}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? "Procesando..." : "Cobrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
