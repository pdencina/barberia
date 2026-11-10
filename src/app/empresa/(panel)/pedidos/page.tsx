"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCan } from "@/components/empresa/shell";
import { api, BUTTON, BUTTON_LIGHT, CARD, INPUT, Message, ORDER_STATUS, Table, TD, Title, useApi } from "@/components/empresa/ui";

function NuevoPedido() {
  const router = useRouter();
  const customers = useApi<{ customers: any[] }>("clientes");
  const products = useApi<{ products: any[] }>("productos");
  const warehouses = useApi<{ warehouses: any[] }>("bodegas");
  const [customerId, setCustomerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState([{ productId: "", quantity: "1" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setItem = (i: number, patch: Partial<{ productId: string; quantity: string }>) =>
    setItems(items.map((it, n) => (n === i ? { ...it, ...patch } : it)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { order } = await api("pedidos", { customerId, warehouseId, items: items.map((it) => ({ productId: it.productId, quantity: Number(it.quantity) })) });
      router.push(`/empresa/pedidos/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={`${CARD} space-y-2`}>
      <div className="grid gap-2 sm:grid-cols-2">
        <select aria-label="Cliente" required className={INPUT} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Cliente</option>
          {customers.data?.customers.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Bodega" required className={INPUT} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">Bodega</option>
          {warehouses.data?.warehouses.filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_6rem_auto] gap-2">
          <select aria-label={`Producto ${i + 1}`} required className={INPUT} value={it.productId} onChange={(e) => setItem(i, { productId: e.target.value })}>
            <option value="">Producto</option>
            {products.data?.products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input aria-label={`Cantidad ${i + 1}`} required type="number" min={1} step={1} className={INPUT} value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
          <button type="button" aria-label={`Quitar producto ${i + 1}`} disabled={items.length === 1} className={BUTTON_LIGHT} onClick={() => setItems(items.filter((_, n) => n !== i))}>×</button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON_LIGHT} onClick={() => setItems([...items, { productId: "", quantity: "1" }])}>Agregar producto</button>
        <button disabled={busy} className={BUTTON}>{busy ? "Creando..." : "Crear borrador"}</button>
      </div>
      <Message error={error} />
    </form>
  );
}

export default function PedidosPage() {
  const can = useCan();
  const { data, error } = useApi<{ orders: any[] }>("pedidos");
  return (
    <div className="space-y-4">
      <Title>Pedidos</Title>
      {can("pedidos.crear") && <NuevoPedido />}
      <Message error={error} />
      <Table head={["Fecha", "Cliente", "Bodega", "Unidades", "Estado", ""]}>
        {data?.orders.map((o) => (
          <tr key={o.id}>
            <td className={TD}>{new Date(o.created_at).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}</td>
            <td className={TD}>{o.customer?.name}</td>
            <td className={TD}>{o.warehouse?.name}</td>
            <td className={TD}>{(o.items || []).reduce((n: number, i: any) => n + i.quantity, 0)}</td>
            <td className={TD}>{ORDER_STATUS[o.status] || o.status}</td>
            <td className={TD}><Link className="text-brand-blue underline" href={`/empresa/pedidos/${o.id}`}>Ver</Link></td>
          </tr>
        ))}
      </Table>
      {data && data.orders.length === 0 && <p className="text-sm text-gray-500">No hay pedidos para mostrar.</p>}
    </div>
  );
}
