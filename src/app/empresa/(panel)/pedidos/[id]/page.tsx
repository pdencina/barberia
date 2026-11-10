"use client";

import Link from "next/link";
import { useState } from "react";
import { useCan } from "@/components/empresa/shell";
import { api, BUTTON, BUTTON_LIGHT, CARD, Message, ORDER_STATUS, Table, TD, Title, useApi } from "@/components/empresa/ui";
import type { Capability } from "@/lib/empresas/capabilities";

const NEXT: Record<string, { action: string; label: string; needs: Capability }> = {
  draft: { action: "confirm", label: "Confirmar y reservar stock", needs: "pedidos.confirmar" },
  confirmed: { action: "prepare", label: "Marcar preparado", needs: "pedidos.preparar" },
  prepared: { action: "dispatch", label: "Despachar y descontar stock", needs: "pedidos.despachar" },
  dispatched: { action: "deliver", label: "Marcar entregado", needs: "pedidos.entregar" },
};

export default function PedidoPage({ params }: { params: { id: string } }) {
  const can = useCan();
  const { data, error, reload } = useApi<{ order: any }>(`pedidos/${params.id}`);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const order = data?.order;

  const run = async (action: string) => {
    if (action === "cancel" && !window.confirm("¿Cancelar este pedido? Se libera lo reservado.")) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`pedidos/${params.id}`, { action });
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo completar.");
    }
    setBusy(false);
  };

  const next = order ? NEXT[order.status] : null;
  const canCancel = order && ["draft", "confirmed", "prepared"].includes(order.status) && can("pedidos.cancelar");

  return (
    <div className="space-y-4">
      <Link href="/empresa/pedidos" className="text-sm text-brand-blue underline">Volver a pedidos</Link>
      <Title>Pedido</Title>
      <Message error={error || msg} />
      {order && (
        <>
          <div className={`${CARD} grid gap-1 text-sm text-brand-dark sm:grid-cols-3`}>
            <p><b>Cliente:</b> {order.customer?.name}{order.source === "portal" && " (pedido hecho por el distribuidor en el portal)"}</p>
            <p><b>Bodega:</b> {order.warehouse?.name}</p>
            <p><b>Estado:</b> {ORDER_STATUS[order.status] || order.status}</p>
            {order.cancel_reason && <p className="sm:col-span-3"><b>Motivo:</b> {order.cancel_reason}</p>}
          </div>
          <Table head={["Producto", "SKU", "Cantidad", "Precio"]}>
            {order.items.map((i: any) => (
              <tr key={i.product_id}>
                <td className={TD}>{i.product?.name}</td>
                <td className={TD}>{i.product?.sku || "-"}</td>
                <td className={TD}>{i.quantity}</td>
                <td className={TD}>{i.unit_price === null ? "-" : `$${Number(i.unit_price).toLocaleString("es-CL")}`}</td>
              </tr>
            ))}
          </Table>
          <div className="flex flex-wrap gap-2">
            {next && can(next.needs) && <button disabled={busy} className={BUTTON} onClick={() => run(next.action)}>{next.label}</button>}
            {canCancel && <button disabled={busy} className={BUTTON_LIGHT} onClick={() => run("cancel")}>Cancelar pedido</button>}
          </div>
        </>
      )}
    </div>
  );
}
