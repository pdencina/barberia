"use client";

import Link from "next/link";
import { useState } from "react";
import { useCan } from "@/components/empresa/shell";
import { api, BUTTON, BUTTON_LIGHT, CARD, COUNT_STATUS, INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";

export default function ConteoPage({ params }: { params: { id: string } }) {
  const can = useCan();
  const { data, error, reload } = useApi<{ count: any; lines: any[] }>(`conteos/${params.id}`);
  const products = useApi<{ products: any[] }>("productos");
  const [productId, setProductId] = useState("");
  const [counted, setCounted] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, setBusy] = useState(false);
  const count = data?.count;
  const showSystem = can("conteos.ver_sistema");
  const isOpen = count?.status === "open";

  const record = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg({});
    try {
      await api(`conteos/${params.id}`, { action: "record", productId, counted: Number(counted) });
      setProductId("");
      setCounted("");
      await reload();
    } catch (err) {
      setMsg({ error: err instanceof Error ? err.message : "No se pudo anotar." });
    }
    setBusy(false);
  };

  const finish = async (action: "close" | "cancel") => {
    const question = action === "close" ? "¿Cerrar el conteo y aplicar las diferencias al stock?" : "¿Cancelar este conteo? No cambia el stock.";
    if (!window.confirm(question)) return;
    setBusy(true);
    setMsg({});
    try {
      const r = await api(`conteos/${params.id}`, { action });
      setMsg({ ok: action === "close" ? `Conteo cerrado. Productos corregidos: ${r.productsChanged}.` : "Conteo cancelado." });
      await reload();
    } catch (err) {
      setMsg({ error: err instanceof Error ? err.message : "No se pudo completar." });
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Link href="/empresa/conteos" className="text-sm text-brand-blue underline">Volver a conteos</Link>
      <Title>Conteo {count?.warehouse?.name ? `· ${count.warehouse.name}` : ""}</Title>
      <Message error={error} />
      {count && <p className="text-sm text-gray-600">Estado: {COUNT_STATUS[count.status] || count.status}</p>}
      {isOpen && (
        <form onSubmit={record} className={`${CARD} grid gap-2 sm:grid-cols-[1fr_8rem_auto]`}>
          <select aria-label="Producto" required className={INPUT} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Producto contado</option>
            {products.data?.products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input aria-label="Cantidad contada" required type="number" min={0} step={1} className={INPUT} placeholder="Contado" value={counted} onChange={(e) => setCounted(e.target.value)} />
          <button disabled={busy} className={BUTTON}>Anotar</button>
        </form>
      )}
      <Message {...msg} />
      <Table head={["Producto", "SKU", "Contado", ...(showSystem ? ["Sistema", "Diferencia"] : [])]}>
        {data?.lines.map((l) => {
          const diff = l.counted_quantity - l.system_quantity;
          return (
            <tr key={l.product_id}>
              <td className={TD}>{l.product?.name}</td>
              <td className={TD}>{l.product?.sku || "-"}</td>
              <td className={TD}>{l.counted_quantity}</td>
              {showSystem && <td className={TD}>{l.system_quantity}</td>}
              {showSystem && <td className={`${TD} font-semibold ${diff < 0 ? "text-red-600" : diff > 0 ? "text-amber-600" : ""}`}>{diff > 0 ? `+${diff}` : diff}</td>}
            </tr>
          );
        })}
      </Table>
      {isOpen && can("conteos.cerrar") && (
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className={BUTTON} onClick={() => finish("close")}>Cerrar y aplicar diferencias</button>
          <button disabled={busy} className={BUTTON_LIGHT} onClick={() => finish("cancel")}>Cancelar conteo</button>
        </div>
      )}
    </div>
  );
}
