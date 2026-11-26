"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import { formatCurrency } from "@/lib/utils";

// Cobros en EFECTIVO pedidos en el tótem: aparecen solos (sin código de Standby, el cliente ya se identificó con el suyo) para que el
// profesional confirme si el dinero coincide. Se muestra encima de todo; al responder desaparece.
interface Pedido { id: string; monto: number; profesional: string; personas: { cliente: string; servicios: string[] }[]; productos: { name: string; quantity: number }[] }

export default function EfectivoTotem() {
  const { tenant } = useTenant();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/totem-efectivo${tenant?.id ? `?tenantId=${tenant.id}` : ""}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setPedidos(Array.isArray(d.pendientes) ? d.pendientes : []);
    } catch { /* se reintenta */ }
  }, [tenant?.id]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 4000);
    return () => clearInterval(t);
  }, [cargar]);

  const responder = async (id: string, coincide: boolean) => {
    setEnviando(true); setError("");
    const r = await fetch("/api/totem-efectivo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: tenant?.id, id, coincide }) });
    const d = await r.json().catch(() => ({}));
    setEnviando(false);
    if (!r.ok) setError(d.error || "No se pudo guardar. Intenta de nuevo.");
    else setAviso(coincide ? (d.registrada ? "Listo: la venta en efectivo quedó registrada." : "Dinero confirmado. La venta no se registró sola: regístrala en el Punto de Venta.") : "Anotado: no se registró la venta y se avisó a administración.");
    await cargar();
  };

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(""), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const p = pedidos[0];
  if (!p) return aviso ? <div role="status" className="fixed inset-x-4 bottom-24 z-[70] mx-auto max-w-md rounded-2xl bg-gray-900 p-4 text-center text-sm font-semibold text-white shadow-xl">{aviso}</div> : null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 text-gray-900 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Pago en efectivo desde el tótem{pedidos.length > 1 ? ` · ${pedidos.length} pendientes` : ""}</p>
        <p className="mt-2 text-5xl font-extrabold">{formatCurrency(p.monto)}</p>
        {p.profesional && <p className="mt-1 text-sm text-gray-500">Atendió: {p.profesional}</p>}
        <ul className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
          {p.personas.map((g, i) => <li key={i}><span className="font-semibold">{g.cliente}</span>: {g.servicios.join(" + ")}</li>)}
          {p.productos.map((x, i) => <li key={`p${i}`}>{x.quantity} × {x.name}</li>)}
        </ul>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <p className="mt-5 text-center text-base font-semibold">¿Recibiste este monto en efectivo?</p>
        <button disabled={enviando} onClick={() => responder(p.id, true)} className="mt-3 w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-50">{enviando ? "Guardando…" : "Sí, coincide"}</button>
        <button disabled={enviando} onClick={() => responder(p.id, false)} className="mt-3 w-full rounded-2xl border border-gray-300 py-4 text-lg font-bold text-gray-700 active:scale-[0.99] disabled:opacity-50">No coincide</button>
      </div>
    </div>
  );
}
