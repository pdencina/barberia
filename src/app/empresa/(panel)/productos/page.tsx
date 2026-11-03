"use client";

import { useState } from "react";
import { useCan } from "@/components/empresa/shell";
import { api, BUTTON, CARD, INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";

const money = (v: number | null | undefined) => (v === null || v === undefined ? "-" : `$${Number(v).toLocaleString("es-CL")}`);
const EMPTY = { name: "", sku: "", category: "", listPrice: "", cost: "", minStock: "0" };

export default function ProductosPage() {
  const can = useCan();
  const { data, error, reload } = useApi<{ products: any[] }>("productos");
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const showCost = can("costos.ver");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({});
    try {
      await api("productos", { ...form, minStock: Number(form.minStock || 0) });
      setForm(EMPTY);
      setMsg({ ok: "Producto creado." });
      reload();
    } catch (err) {
      setMsg({ error: err instanceof Error ? err.message : "No se pudo crear." });
    }
  };

  return (
    <div className="space-y-4">
      <Title>Productos</Title>
      {can("productos.editar") && (
        <form onSubmit={submit} className={`${CARD} grid gap-2 sm:grid-cols-3 lg:grid-cols-7`}>
          <input aria-label="Nombre" required className={INPUT} placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input aria-label="SKU" className={INPUT} placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <input aria-label="Categoría" className={INPUT} placeholder="Categoría" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input aria-label="Precio" type="number" min={0} className={INPUT} placeholder="Precio" value={form.listPrice} onChange={(e) => setForm({ ...form, listPrice: e.target.value })} />
          <input aria-label="Costo" type="number" min={0} className={INPUT} placeholder="Costo" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          <input aria-label="Stock mínimo" type="number" min={0} className={INPUT} placeholder="Mínimo" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          <button className={BUTTON}>Crear</button>
          <div className="sm:col-span-3 lg:col-span-7"><Message {...msg} /></div>
        </form>
      )}
      <Message error={error} />
      <Table head={["Nombre", "SKU", "Categoría", "Precio", ...(showCost ? ["Costo"] : []), "Mínimo", "Estado"]}>
        {data?.products.map((p) => (
          <tr key={p.id}>
            <td className={TD}>{p.name}</td>
            <td className={TD}>{p.sku || "-"}</td>
            <td className={TD}>{p.category || "-"}</td>
            <td className={TD}>{money(p.list_price)}</td>
            {showCost && <td className={TD}>{money(p.cost)}</td>}
            <td className={TD}>{p.min_stock}</td>
            <td className={TD}>{p.active ? "Activo" : "Inactivo"}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
