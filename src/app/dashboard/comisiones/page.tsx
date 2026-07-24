"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";

interface BarberCommission {
  barberId: string;
  barberName: string;
  commissionRate: number;
  totalSales: number;
  commissionAmount: number;
  paidAmount: number;
  pendingAmount: number;
  transactionCount: number;
}

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function ComisionesPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [barbers, setBarbers] = useState<BarberCommission[]>([]);
  const [totals, setTotals] = useState({ totalSales: 0, totalCommissions: 0, totalPaid: 0, totalPending: 0 });
  const [loading, setLoading] = useState(true);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [newRate, setNewRate] = useState("");
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch(`/api/comisiones?month=${month}&year=${year}`);
    const data = await res.json();
    setBarbers(data.barbers || []);
    setTotals(data.totals || { totalSales: 0, totalCommissions: 0, totalPaid: 0, totalPending: 0 });
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [month, year]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  const updateRate = async (barberId: string) => {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      showToast("Porcentaje invalido (0-100)", "error");
      return;
    }
    await fetch("/api/comisiones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barberId, commissionRate: rate }),
    });
    showToast("Comision actualizada", "success");
    setEditingRate(null);
    setNewRate("");
    fetchData();
  };

  const markAsPaid = async (barber: BarberCommission) => {
    const ok = await confirm({
      title: "Marcar como pagado",
      message: `Confirmas el pago de ${formatCurrency(barber.pendingAmount)} a ${barber.barberName}?`,
      confirmText: "Si, marcar pagado",
      variant: "warning",
    });
    if (!ok) return;

    await fetch("/api/comisiones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barberId: barber.barberId,
        amount: barber.pendingAmount,
        month,
        year,
      }),
    });
    showToast(`Pago registrado para ${barber.barberName}`, "success");
    fetchData();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comisiones</h1>
        <p className="text-gray-500 text-sm">Calculo automatico por barbero</p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-4">
        <button onClick={() => changeMonth(-1)} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">←</button>
        <span className="text-lg font-bold">{monthNames[month - 1]} {year}</span>
        <button onClick={() => changeMonth(1)} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">→</button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-xs text-gray-500 uppercase">Ventas Totales</p>
          <p className="text-xl font-bold">{formatCurrency(totals.totalSales)}</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-xs text-gray-500 uppercase">Comisiones Generadas</p>
          <p className="text-xl font-bold text-purple-600">{formatCurrency(totals.totalCommissions)}</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-xs text-gray-500 uppercase">Pagado</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totals.totalPaid)}</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-yellow-500">
          <p className="text-xs text-gray-500 uppercase">Pendiente</p>
          <p className="text-xl font-bold text-yellow-600">{formatCurrency(totals.totalPending)}</p>
        </div>
      </div>

      {/* Barbers table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4 font-medium text-gray-600">Barbero</th>
              <th className="text-center p-4 font-medium text-gray-600">% Comision</th>
              <th className="text-center p-4 font-medium text-gray-600">Ventas</th>
              <th className="text-right p-4 font-medium text-gray-600">Total Vendido</th>
              <th className="text-right p-4 font-medium text-gray-600">Comision</th>
              <th className="text-right p-4 font-medium text-gray-600">Pagado</th>
              <th className="text-right p-4 font-medium text-gray-600">Pendiente</th>
              <th className="text-center p-4 font-medium text-gray-600">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={8}><Spinner /></td></tr>
            ) : barbers.length === 0 ? (
              <tr><td colSpan={8} className="p-4 text-center text-gray-400">No hay datos para este periodo</td></tr>
            ) : barbers.map((b) => (
              <tr key={b.barberId} className="hover:bg-gray-50">
                <td className="p-4 font-medium">{b.barberName}</td>
                <td className="p-4 text-center">
                  {editingRate === b.barberId ? (
                    <div className="flex items-center gap-1 justify-center">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={newRate}
                        onChange={(e) => setNewRate(e.target.value)}
                        className="w-16 border rounded px-2 py-1 text-center text-sm"
                        autoFocus
                      />
                      <button onClick={() => updateRate(b.barberId)} className="text-green-600 text-xs font-bold">✓</button>
                      <button onClick={() => setEditingRate(null)} className="text-red-600 text-xs font-bold">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingRate(b.barberId); setNewRate(String(b.commissionRate)); }}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {b.commissionRate}%
                    </button>
                  )}
                </td>
                <td className="p-4 text-center text-gray-500">{b.transactionCount}</td>
                <td className="p-4 text-right">{formatCurrency(b.totalSales)}</td>
                <td className="p-4 text-right font-medium text-purple-600">{formatCurrency(b.commissionAmount)}</td>
                <td className="p-4 text-right text-green-600">{formatCurrency(b.paidAmount)}</td>
                <td className="p-4 text-right font-bold text-yellow-600">{formatCurrency(b.pendingAmount)}</td>
                <td className="p-4 text-center">
                  {b.pendingAmount > 0 && (
                    <button
                      onClick={() => markAsPaid(b)}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                    >
                      Pagar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
