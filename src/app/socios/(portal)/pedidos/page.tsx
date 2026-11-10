"use client";

import { useEffect, useState } from "react";
import { Message, ORDER_STATUS, Table, TD, Title } from "@/components/empresa/ui";

const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

export default function MisPedidosPage() {
  const [orders, setOrders] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/socios/pedidos").then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo cargar.");
      setOrders(d.orders);
    }).catch((e) => setError(e.message));
  }, []);
  return (
    <div className="space-y-4">
      <Title>Mis pedidos</Title>
      <Message error={error} />
      <Table head={["Fecha", "Productos", "Total", "Estado"]}>
        {(orders || []).map((o) => {
          const total = o.items.reduce((s: number, i: any) => s + (i.unitPrice ?? 0) * i.quantity, 0);
          return (
            <tr key={o.id}>
              <td className={TD}>{new Date(o.created_at).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}</td>
              <td className={`${TD} text-xs`}>{o.items.map((i: any) => `${i.quantity} × ${i.name}`).join(", ")}</td>
              <td className={TD}>{o.items.some((i: any) => "unitPrice" in i) ? clp(total) : "-"}</td>
              <td className={TD}>{o.status === "draft" ? "Por confirmar" : ORDER_STATUS[o.status] || o.status}</td>
            </tr>
          );
        })}
      </Table>
      {orders && orders.length === 0 && <p className="text-sm text-gray-500">Todavía no tienes pedidos.</p>}
    </div>
  );
}
