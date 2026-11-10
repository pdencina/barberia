"use client";

import { useState } from "react";
import { useCan } from "@/components/empresa/shell";
import { api, apiPatch, BUTTON, CARD, errorText, INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";

const money = (v: number | null | undefined) => (v === null || v === undefined ? "-" : `$${Number(v).toLocaleString("es-CL")}`);
const EMPTY = { name: "", sku: "", brandId: "", category: "", listPrice: "", cost: "", minStock: "0" };

export default function ProductosPage() {
  const can = useCan();
  const { data, error, reload } = useApi<{ products: any[] }>("productos");
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const showCost = can("costos.ver");
  const brandsApi = useApi<{ brands: any[] }>("marcas");
  const brands = (brandsApi.data?.brands || []).filter((b) => b.active);
  const brandName = (id: string | null) => brandsApi.data?.brands.find((b) => b.id === id)?.name || "-";
  const [brandFilter, setBrandFilter] = useState("");
  const setBrand = async (id: string, brandId: string) => {
    setMsg({});
    try { await apiPatch(`productos/${id}`, { brandId: brandId || null }); reload(); } catch (err) { setMsg({ error: errorText(err) }); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({});
    try {
      await api("productos", { ...form, brandId: form.brandId || undefined, minStock: Number(form.minStock || 0) });
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
        <form onSubmit={submit} className={`${CARD} grid gap-2 sm:grid-cols-3 lg:grid-cols-8`}>
          <input aria-label="Nombre" required className={INPUT} placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input aria-label="SKU" className={INPUT} placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <select aria-label="Marca" className={INPUT} value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
            <option value="">Marca...</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input aria-label="Categoría" className={INPUT} placeholder="Categoría" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input aria-label="Precio" type="number" min={0} className={INPUT} placeholder="Precio" value={form.listPrice} onChange={(e) => setForm({ ...form, listPrice: e.target.value })} />
          <input aria-label="Costo" type="number" min={0} className={INPUT} placeholder="Costo" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          <input aria-label="Stock mínimo" type="number" min={0} className={INPUT} placeholder="Mínimo" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          <button className={BUTTON}>Crear</button>
          <div className="sm:col-span-3 lg:col-span-8"><Message {...msg} /></div>
        </form>
      )}
      <Message error={error} />
      {brands.length > 0 && (
        <select aria-label="Filtrar por marca" className={`${INPUT} sm:w-64`} value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
          <option value="">Todas las marcas</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          <option value="sin">Sin marca</option>
        </select>
      )}
      <Table head={["Nombre", "SKU", "Marca", "Categoría", "Precio", ...(showCost ? ["Costo"] : []), "Mínimo", "Estado"]}>
        {data?.products.filter((p) => !brandFilter || (brandFilter === "sin" ? !p.brand_id : p.brand_id === brandFilter)).map((p) => (
          <tr key={p.id}>
            <td className={TD}>{p.name}</td>
            <td className={TD}>{p.sku || "-"}</td>
            <td className={TD}>
              {can("productos.editar") && "brand_id" in p ? (
                <select aria-label={`Marca de ${p.name}`} className={`${INPUT} h-8 w-auto`} value={p.brand_id || ""} onChange={(e) => setBrand(p.id, e.target.value)}>
                  <option value="">Sin marca</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              ) : brandName(p.brand_id ?? null)}
            </td>
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
