"use client";

import { useState } from "react";
import { INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";

const hoy = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

export default function ReportePage() {
  const [day, setDay] = useState(hoy());
  const { data, error } = useApi<any>(`reporte?week=${day}`);
  const rows: any[] = data?.rows || [];
  const tot = rows.reduce((a, r) => ({ portfolio: a.portfolio + r.portfolio, managed: a.managed + r.managed, sold: a.sold + r.sold, unattended: a.unattended + r.unattended, skipped: a.skipped + r.skipped }), { portfolio: 0, managed: 0, sold: 0, unattended: 0, skipped: 0 });
  return (
    <div className="space-y-4">
      <Title>Reporte semanal de vendedores</Title>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-gray-600" htmlFor="semana">Semana que incluye el día</label>
        <input id="semana" type="date" className={`${INPUT} w-auto`} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        {data?.weekStart && <span className="text-sm text-gray-500">(lunes {data.weekStart})</span>}
      </div>
      <Message error={error} />
      <Table head={["Vendedor", "Cartera", "Gestionados", "Vendidos", "Sin atender", "Saltados"]}>
        {rows.map((r) => (
          <tr key={r.sellerId}>
            <td className={TD}>{r.name}</td>
            <td className={TD}>{r.portfolio}</td>
            <td className={TD}>{r.managed}</td>
            <td className={TD}>{r.sold}</td>
            <td className={`${TD} ${r.unattended ? "font-semibold text-red-700" : ""}`}>{r.unattended}</td>
            <td className={TD}>{r.skipped}</td>
          </tr>
        ))}
        {rows.length > 1 && (
          <tr className="font-semibold">
            <td className={TD}>Total</td><td className={TD}>{tot.portfolio}</td><td className={TD}>{tot.managed}</td>
            <td className={TD}>{tot.sold}</td><td className={TD}>{tot.unattended}</td><td className={TD}>{tot.skipped}</td>
          </tr>
        )}
      </Table>
      <p className="text-xs text-gray-500">
        Gestionados: clientes de la cartera con al menos un llamado anotado (o un pedido) en la semana. Vendidos: con pedido o “Vendió”.
        Sin atender: de la cartera, sin nada en la semana. Los llamados los anota el vendedor; el sistema no puede comprobar que ocurrieron.
        El envío por correo cada lunes se activa en Configuración.
      </p>
    </div>
  );
}
