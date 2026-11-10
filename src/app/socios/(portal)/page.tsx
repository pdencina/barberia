"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BUTTON, CARD, INPUT, Message, Table, TD, Title } from "@/components/empresa/ui";

const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

async function socios<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/socios/${path}`, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo completar la acción.");
  return data as T;
}

export default function CatalogoPage() {
  const [products, setProducts] = useState<any[] | null>(null);
  const [tier, setTier] = useState<{ name: string; discountPct: number } | null>(null);
  const [cart, setCart] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [done, setDone] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    socios<{ products: any[]; tier: any }>("catalogo").then((d) => { setProducts(d.products); setTier(d.tier); }).catch((e) => setMsg({ error: e.message }));
  }, []);

  const lines = useMemo(() => Object.entries(cart).map(([id, q]) => ({ productId: id, quantity: Number(q) })).filter((l) => Number.isInteger(l.quantity) && l.quantity > 0), [cart]);
  const showPrices = (products || []).some((p) => "price" in p);
  const total = lines.reduce((s, l) => s + (products?.find((p) => p.id === l.productId)?.price ?? 0) * l.quantity, 0);
  const q = search.trim().toLowerCase();
  const rows = (products || []).filter((p) => !q || [p.name, p.sku, p.category].some((v) => (v || "").toLowerCase().includes(q)));

  const submit = async () => {
    setBusy(true);
    setMsg({});
    try {
      const r = await socios("pedidos", { items: lines, notes });
      setDone(r.order);
      setCart({});
      setNotes("");
    } catch (e) {
      setMsg({ error: e instanceof Error ? e.message : "No se pudo enviar el pedido." });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className={`${CARD} space-y-3`}>
        <Title>Pedido enviado</Title>
        <p className="text-sm text-brand-dark">Tu vendedor recibió el pedido y lo va a confirmar. Puedes seguirlo en “Mis pedidos”.</p>
        <ul className="list-disc pl-5 text-sm text-brand-dark">
          {done.lines.map((l: any, i: number) => <li key={i}>{l.quantity} × {l.name}{l.unitPrice != null ? ` (${clp(l.unitPrice * l.quantity)})` : ""}</li>)}
        </ul>
        <div className="flex gap-2">
          <Link href="/socios/pedidos" className={`${BUTTON} inline-flex items-center`}>Ver mis pedidos</Link>
          <button className="text-sm text-brand-blue underline" onClick={() => setDone(null)}>Hacer otro pedido</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Title>Catálogo</Title>
      {tier && <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">Tu precio: <b>{tier.name}</b> ({tier.discountPct}% de descuento sobre el precio de lista).</p>}
      <Message {...msg} />
      <input aria-label="Buscar producto" className={`${INPUT} sm:w-80`} placeholder="Buscar producto, SKU o categoría" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Table head={["Producto", "SKU", ...(showPrices ? ["Precio"] : []), "Stock", "Cantidad"]}>
        {rows.map((p) => (
          <tr key={p.id}>
            <td className={TD}>{p.name}{p.category && <span className="block text-xs text-gray-500">{p.category}</span>}</td>
            <td className={TD}>{p.sku || "-"}</td>
            {showPrices && (
              <td className={TD}>
                {p.price != null ? clp(p.price) : "-"}
                {p.listPrice != null && <span className="ml-1 text-xs text-gray-400 line-through">{clp(p.listPrice)}</span>}
              </td>
            )}
            <td className={TD}>
              {p.inStock ? <span className="text-green-700">{"available" in p ? p.available : "Disponible"}</span> : <span className="text-gray-400">Agotado</span>}
            </td>
            <td className={TD}>
              <input aria-label={`Cantidad de ${p.name}`} type="number" min={0} className={`${INPUT} h-8 w-24`} value={cart[p.id] ?? ""} onChange={(e) => setCart({ ...cart, [p.id]: e.target.value })} />
            </td>
          </tr>
        ))}
      </Table>
      {products && products.length === 0 && <p className="text-sm text-gray-500">Todavía no hay productos en el catálogo.</p>}
      <div className={`${CARD} space-y-2`}>
        <p className="text-sm text-brand-dark"><b>{lines.length}</b> productos en tu pedido{showPrices && lines.length > 0 && <> · Total referencial <b>{clp(total)}</b></>}</p>
        <textarea aria-label="Nota para el vendedor" className={`${INPUT} h-16 py-2`} placeholder="Nota para tu vendedor (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className={BUTTON} disabled={busy || lines.length === 0} onClick={submit}>{busy ? "Enviando..." : "Enviar pedido"}</button>
        <p className="text-xs text-gray-500">El stock es referencial: se reserva cuando tu vendedor confirma el pedido.</p>
      </div>
    </div>
  );
}
