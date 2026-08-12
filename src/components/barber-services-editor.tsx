"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

export function BarberServicesEditor({ barberId, showToast }: { barberId: string; showToast: (msg: string, type?: "success" | "error" | "info") => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/services?all=true").then((r) => r.json()),
      fetch(`/api/barber-service-assignments?barberId=${barberId}`).then((r) => r.json()),
    ]).then(([svcs, assignedIds]) => {
      setServices(Array.isArray(svcs) ? svcs.filter((s: any) => s.active !== false) : []);
      setAssigned(Array.isArray(assignedIds) ? assignedIds : []);
    });
  }, [barberId]);

  const toggle = (serviceId: string) => {
    if (assigned.includes(serviceId)) {
      setAssigned(assigned.filter((id) => id !== serviceId));
    } else {
      setAssigned([...assigned, serviceId]);
    }
  };

  const selectAll = () => setAssigned(services.map((s) => s.id));
  const selectNone = () => setAssigned([]);

  const save = async () => {
    setSaving(true);
    await fetch("/api/barber-service-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barberId, serviceIds: assigned }),
    });
    setSaving(false);
    showToast("Servicios actualizados", "success");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-brand-gray">{assigned.length}/{services.length} seleccionados</span>
        <div className="flex gap-2">
          <button onClick={selectAll} className="text-[10px] text-brand-blue hover:underline">Todos</button>
          <button onClick={selectNone} className="text-[10px] text-brand-gray hover:underline">Ninguno</button>
        </div>
      </div>
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {services.map((s) => (
          <label key={s.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-brand-light cursor-pointer">
            <input type="checkbox" checked={assigned.includes(s.id)} onChange={() => toggle(s.id)}
              className="w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
            <div className="flex-1">
              <p className="text-sm text-brand-dark font-medium">{s.name}</p>
              <p className="text-[10px] text-brand-gray">{s.duration} min · {formatCurrency(Number(s.price))}</p>
            </div>
          </label>
        ))}
      </div>
      <button onClick={save} disabled={saving}
        className="mt-3 px-4 py-2 bg-brand-blue text-white text-sm rounded-xl hover:opacity-90 disabled:opacity-50">
        {saving ? "Guardando..." : "Guardar Servicios"}
      </button>
    </div>
  );
}
