"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

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
  const [clientSearch, setClientSearch] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [splitMode, setSplitMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState<Array<{ method: string; amount: string }>>([
    { method: "debit_card", amount: "" },
    { method: "cash", amount: "" },
  ]);
  const [processing, setProcessing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([
      fetch("/api/services").then((r) => r.json()).catch(() => []),
      fetch("/api/products").then((r) => r.json()).catch(() => []),
      fetch("/api/clients").then((r) => r.json()).catch(() => ({ clients: [] })),
      fetch("/api/barberos").then((r) => r.json()).catch(() => []),
    ]).then(([servicesData, productsData, clientsData, barbersData]) => {
      setServices(Array.isArray(servicesData) ? servicesData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setClients(Array.isArray(clientsData?.clients) ? clientsData.clients : Array.isArray(clientsData) ? clientsData : []);
      setBarbers(Array.isArray(barbersData) ? barbersData : []);
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
      setCart([...cart, { id: item.id, name: item.name, price: Number(item.price), quantity: 1, type }]);
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

  const subtotal = cart.reduce((sum, c) => sum + Number(c.price) * c.quantity, 0);
  const total = subtotal - discount;

  const applyCoupon = async () => {
    setCouponError("");
    if (!couponCode) return;
    try {
      const res = await fetch(`/api/cupones/validate?code=${couponCode}&amount=${subtotal}`);
      const data = await res.json();
      if (data.valid) {
        setDiscount(data.discount);
        showToast("Cupon aplicado", "success");
      } else {
        setCouponError(data.message || "Cupon invalido");
        setDiscount(0);
      }
    } catch {
      setCouponError("Error al validar cupon");
    }
  };

  const handleCheckout = async () => {
    // Validate based on mode
    if (!selectedBarber || cart.length === 0) return;
    if (splitMode) {
      const splitTotal = splitPayments.reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
      if (splitTotal !== total) return;
    } else {
      if (!paymentMethod) return;
    }

    setProcessing(true);
    try {
      const payments = splitMode
        ? splitPayments.filter((p) => parseInt(p.amount) > 0).map((p) => ({ method: p.method, amount: parseInt(p.amount) }))
        : undefined;

      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId: selectedBarber,
          clientId: selectedClient || null,
          items: cart,
          paymentMethod: splitMode ? "mixed" : paymentMethod,
          payments,
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
        setSplitMode(false);
        setSplitPayments([{ method: "debit_card", amount: "" }, { method: "cash", amount: "" }]);
        setSelectedClient("");
        showToast("Venta registrada exitosamente", "success");
      }
    } catch (err) {
      console.error("Error en checkout:", err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-4rem)]">
      {/* Left: Items */}
      <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
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
              <p className="text-indigo-600 font-bold">{formatCurrency(Number(item.price))}</p>
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
      <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l flex flex-col max-h-[60vh] lg:max-h-none">
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
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setSelectedClient("");
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              {clientSearch && !selectedClient && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                  {clients
                    .filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                    .slice(0, 5)
                    .map((c) => (
                      <button key={c.id} onClick={() => { setSelectedClient(c.id); setClientSearch(c.name); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100">
                        {c.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
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
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">Metodo de pago</span>
              <button onClick={() => setSplitMode(!splitMode)}
                className={`text-[10px] px-2 py-0.5 rounded-full ${splitMode ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                {splitMode ? "Pago dividido ✓" : "Dividir pago"}
              </button>
            </div>

            {!splitMode ? (
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
            ) : (
              <div className="space-y-2">
                {splitPayments.map((sp, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={sp.method}
                      onChange={(e) => {
                        const updated = [...splitPayments];
                        updated[i].method = e.target.value;
                        setSplitPayments(updated);
                      }}
                      className="border rounded-lg px-2 py-1.5 text-sm flex-1">
                      <option value="cash">Efectivo</option>
                      <option value="debit_card">Debito</option>
                      <option value="credit_card">Credito</option>
                      <option value="transfer">Transfer</option>
                    </select>
                    <input type="number" placeholder="$" value={sp.amount}
                      onChange={(e) => {
                        const updated = [...splitPayments];
                        updated[i].amount = e.target.value;
                        setSplitPayments(updated);
                      }}
                      className="border rounded-lg px-2 py-1.5 text-sm w-24 text-right" />
                    {splitPayments.length > 2 && (
                      <button onClick={() => setSplitPayments(splitPayments.filter((_, idx) => idx !== i))}
                        className="text-red-400 text-xs">✕</button>
                    )}
                  </div>
                ))}
                {splitPayments.length < 4 && (
                  <button onClick={() => setSplitPayments([...splitPayments, { method: "cash", amount: "" }])}
                    className="text-xs text-blue-600 hover:underline">+ Agregar metodo</button>
                )}
                {(() => {
                  const splitTotal = splitPayments.reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
                  const diff = total - splitTotal;
                  return diff !== 0 ? (
                    <p className={`text-xs ${diff > 0 ? "text-red-500" : "text-orange-500"}`}>
                      {diff > 0 ? `Faltan ${formatCurrency(diff)}` : `Excede en ${formatCurrency(Math.abs(diff))}`}
                    </p>
                  ) : <p className="text-xs text-green-600 font-medium">✓ Pago cuadra</p>;
                })()}
              </div>
            )}
          </div>

          <button
            onClick={handleCheckout}
            disabled={
              !selectedBarber || cart.length === 0 || processing ||
              (splitMode
                ? splitPayments.reduce((s, p) => s + (parseInt(p.amount) || 0), 0) !== total
                : !paymentMethod)
            }
            className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? "Procesando..." : "Cobrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
