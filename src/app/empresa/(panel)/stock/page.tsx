"use client";

import { useMemo, useRef, useState } from "react";
import { useCan } from "@/components/empresa/shell";
import { api, BUTTON, CARD, INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";

type Row = { warehouseId: string; warehouseName: string; productId: string; productName: string; sku: string | null; minStock: number; quantity: number; reserved: number; available: number };

const TYPES = [
  { value: "in", label: "Entrada" },
  { value: "out", label: "Salida" },
  { value: "transfer", label: "Traspaso" },
  { value: "adjust", label: "Ajuste" },
];

export default function StockPage() {
  const can = useCan();
  const stock = useApi<{ stock: Row[] }>("stock");
  const products = useApi<{ products: { id: string; name: string; active: boolean }[] }>("productos");
  const warehouses = useApi<{ warehouses: { id: string; name: string; active: boolean }[] }>("bodegas");
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({ type: "in", productId: "", warehouseId: "", toWarehouseId: "", quantity: "", reason: "" });
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, setBusy] = useState(false);
  // La misma llave en un reintento evita duplicar el movimiento; se cambia solo cuando el servidor responde.
  const key = useRef<string | null>(null);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (stock.data?.stock || [])
      .filter((r) => !q || r.productName?.toLowerCase().includes(q) || r.sku?.toLowerCase().includes(q))
      .sort((x, y) => (x.productName || "").localeCompare(y.productName || "", "es") || (x.warehouseName || "").localeCompare(y.warehouseName || "", "es"));
  }, [stock.data, filter]);
  const missing = rows.filter((r) => r.available < 0).length;
  const types = TYPES.filter((t) => t.value !== "adjust" || can("stock.ajustar"));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg({});
    key.current = key.current || crypto.randomUUID();
    try {
      await api("stock/mover", {
        type: form.type, productId: form.productId, warehouseId: form.warehouseId,
        toWarehouseId: form.type === "transfer" ? form.toWarehouseId : null,
        quantity: Number(form.quantity), reason: form.reason, idempotencyKey: key.current,
      });
      setMsg({ ok: "Movimiento registrado." });
      setForm({ ...form, quantity: "", reason: "" });
      stock.reload();
      key.current = null;
    } catch (err) {
      setMsg({ error: err instanceof Error ? err.message : "No se pudo registrar." });
      if (!(err instanceof TypeError)) key.current = null;
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Title>Stock por bodega</Title>
      {missing > 0 && <Message error={`${missing} producto(s) con faltante: hay menos unidades que las reservadas por pedidos.`} />}
      {can("stock.mover") && (
        <form onSubmit={submit} className={`${CARD} grid gap-2 sm:grid-cols-3 lg:grid-cols-6`}>
          <select aria-label="Tipo" className={INPUT} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select aria-label="Producto" required className={INPUT} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
            <option value="">Producto</option>
            {products.data?.products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select aria-label="Bodega" required className={INPUT} value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
            <option value="">{form.type === "transfer" ? "Desde bodega" : "Bodega"}</option>
            {warehouses.data?.warehouses.filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {form.type === "transfer" && (
            <select aria-label="Bodega de destino" required className={INPUT} value={form.toWarehouseId} onChange={(e) => setForm({ ...form, toWarehouseId: e.target.value })}>
              <option value="">Hacia bodega</option>
              {warehouses.data?.warehouses.filter((w) => w.active && w.id !== form.warehouseId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
          <input aria-label="Cantidad" required type="number" step={1} min={form.type === "adjust" ? undefined : 1} className={INPUT}
            placeholder={form.type === "adjust" ? "Diferencia (+/-)" : "Cantidad"} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <input aria-label="Motivo" required={form.type === "adjust"} className={INPUT} placeholder="Motivo" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <button disabled={busy} className={BUTTON}>{busy ? "Guardando..." : "Registrar"}</button>
          <div className="sm:col-span-3 lg:col-span-6"><Message {...msg} /></div>
        </form>
      )}
      <input aria-label="Buscar producto" className={`${INPUT} max-w-xs`} placeholder="Buscar producto o SKU" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <Message error={stock.error} />
      <Table head={["Producto", "Bodega", "Disponible", "Físico", "Reservado", "SKU"]}>
        {rows.map((r) => (
          <tr key={`${r.warehouseId}:${r.productId}`}>
            <td className={TD}>{r.productName}</td>
            <td className={TD}>{r.warehouseName}</td>
            <td className={`${TD} font-semibold ${r.available < 0 ? "text-red-600" : r.available <= r.minStock ? "text-amber-600" : ""}`}>{r.available}</td>
            <td className={TD}>{r.quantity}</td>
            <td className={TD}>{r.reserved}</td>
            <td className={TD}>{r.sku || "-"}</td>
          </tr>
        ))}
      </Table>
      {stock.data && rows.length === 0 && <p className="text-sm text-gray-500">Sin stock registrado todavía.</p>}
    </div>
  );
}
