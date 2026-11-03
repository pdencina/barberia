"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCan } from "@/components/empresa/shell";
import { api, BUTTON, CARD, COUNT_STATUS, INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";

export default function ConteosPage() {
  const can = useCan();
  const router = useRouter();
  const { data, error } = useApi<{ counts: any[] }>("conteos");
  const warehouses = useApi<{ warehouses: any[] }>("bodegas");
  const [warehouseId, setWarehouseId] = useState("");
  const [msg, setMsg] = useState("");

  const open = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      const { id } = await api("conteos", { warehouseId });
      router.push(`/empresa/conteos/${id}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo abrir.");
    }
  };

  return (
    <div className="space-y-4">
      <Title>Toma de inventario</Title>
      {can("conteos.contar") && (
        <form onSubmit={open} className={`${CARD} flex flex-wrap gap-2`}>
          <select aria-label="Bodega" required className={`${INPUT} max-w-xs`} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">Bodega a contar</option>
            {warehouses.data?.warehouses.filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button className={BUTTON}>Abrir conteo</button>
        </form>
      )}
      <Message error={error || msg} />
      <Table head={["Fecha", "Bodega", "Estado", ""]}>
        {data?.counts.map((c) => (
          <tr key={c.id}>
            <td className={TD}>{new Date(c.created_at).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}</td>
            <td className={TD}>{c.warehouse?.name}</td>
            <td className={TD}>{COUNT_STATUS[c.status] || c.status}</td>
            <td className={TD}><Link className="text-brand-blue underline" href={`/empresa/conteos/${c.id}`}>Ver</Link></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
