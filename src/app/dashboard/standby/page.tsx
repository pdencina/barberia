"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";

interface Service { id: string; name: string; price: number; duration: number; }
interface Barber { id: string; name: string; }

export default function StandbyPage() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedBarber, setSelectedBarber] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [clientName, setClientName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([
      fetch("/api/barberos").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
    ]).then(([b, s]) => {
      setBarbers(Array.isArray(b) ? b : []);
      setServices(Array.isArray(s) ? s : []);
      setLoading(false);
    });
  }, []);

  const total = services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((sum, s) => sum + Number(s.price), 0);

  const handleQuickSale = async () => {
    if (!selectedBarber || selectedServices.length === 0) return;
    setProcessing(true);

    const items = services
      .filter((s) => selectedServices.includes(s.id))
      .map((s) => ({ id: s.id, name: s.name, price: Number(s.price), quantity: 1, type: "service" }));

    await fetch("/api/pos/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barberId: selectedBarber,
        clientId: null,
        items,
        paymentMethod,
        couponCode: null,
        discount: 0,
        subtotal: total,
        total,
      }),
    });

    showToast(`Venta de ${formatCurrency(total)} registrada`, "success");
    setSelectedServices([]);
    setClientName("");
    setProcessing(false);
  };

  if (loading) return <Spinner />;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Modo Standby</h1>
        <p className="text-sm text-gray-500">Venta rapida sin recepcionista</p>
      </div>

      {/* Barber select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Barbero</label>
        <div className="grid grid-cols-3 gap-2">
          {barbers.map((b) => (
            <button key={b.id} onClick={() => setSelectedBarber(b.id)}
              className={`p-3 rounded-lg border text-center text-sm font-medium transition-colors ${
                selectedBarber === b.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 hover:border-gray-300"
              }`}>
              {b.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Services */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Servicios</label>
        <div className="grid grid-cols-2 gap-2">
          {services.map((s) => {
            const isSelected = selectedServices.includes(s.id);
            return (
              <button key={s.id}
                onClick={() => setSelectedServices(isSelected ? selectedServices.filter((x) => x !== s.id) : [...selectedServices, s.id])}
                className={`p-3 rounded-lg border text-left text-sm transition-colors ${
                  isSelected ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                }`}>
                <p className="font-medium">{s.name}</p>
                <p className="text-indigo-600 font-bold">{formatCurrency(Number(s.price))}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Payment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pago</label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { key: "cash", label: "Efectivo" },
            { key: "debit_card", label: "Debito" },
            { key: "credit_card", label: "Credito" },
            { key: "transfer", label: "Transfer" },
          ].map((m) => (
            <button key={m.key} onClick={() => setPaymentMethod(m.key)}
              className={`py-2 rounded-lg text-xs font-medium ${
                paymentMethod === m.key ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700"
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Total + Submit */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-600">Total</span>
          <span className="text-3xl font-bold">{formatCurrency(total)}</span>
        </div>
        <button onClick={handleQuickSale}
          disabled={!selectedBarber || selectedServices.length === 0 || processing}
          className="w-full py-4 bg-green-600 text-white font-bold text-lg rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {processing ? "Procesando..." : "Registrar Venta"}
        </button>
      </div>
    </div>
  );
}
