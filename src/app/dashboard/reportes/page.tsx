"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface ReportData {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    totalTransactions: number;
    appointmentsCompleted: number;
    newClients: number;
  };
  incomeByBarber: Array<{ name: string; total: number; count: number }>;
  incomeByMethod: Array<{ method: string; total: number; count: number }>;
  topServices: Array<{ name: string; count: number; total: number }>;
  topProducts: Array<{ name: string; count: number; total: number }>;
}

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const paymentMethodLabels: Record<string, string> = {
  cash: "Efectivo",
  debit_card: "Debito",
  credit_card: "Credito",
  transfer: "Transferencia",
};

export default function ReportesPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reportes/monthly?month=${month}&year=${year}`);
      const result = await res.json();
      if (result.summary) {
        setData(result);
      }
    } catch (err) {
      console.error("Error fetching report:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [month, year]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  if (loading || !data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Reportes</h1>
        <p className="text-gray-500 text-center py-8">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center gap-4">
        <button onClick={() => changeMonth(-1)}
          className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">&larr;</button>
        <span className="text-lg font-medium">{monthNames[month - 1]} {year}</span>
        <button onClick={() => changeMonth(1)}
          className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">&rarr;</button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-xs text-gray-500">Ingresos</p>
          <p className="text-lg font-bold text-green-600">{formatCurrency(data.summary.totalIncome)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-xs text-gray-500">Egresos</p>
          <p className="text-lg font-bold text-red-600">{formatCurrency(data.summary.totalExpenses)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-xs text-gray-500">Utilidad</p>
          <p className="text-lg font-bold text-indigo-600">{formatCurrency(data.summary.netProfit)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-xs text-gray-500">Transacciones</p>
          <p className="text-lg font-bold text-gray-900">{data.summary.totalTransactions}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-xs text-gray-500">Citas</p>
          <p className="text-lg font-bold text-gray-900">{data.summary.appointmentsCompleted}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-xs text-gray-500">Clientes Nuevos</p>
          <p className="text-lg font-bold text-gray-900">{data.summary.newClients}</p>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income by Barber */}
        <div className="bg-white rounded-lg shadow">
          <h3 className="font-bold text-gray-800 p-4 border-b">Ingresos por Barbero</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">Barbero</th>
                <th className="text-right p-3 font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.incomeByBarber?.map((row, i) => (
                <tr key={i}>
                  <td className="p-3">{row.name}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* By Payment Method */}
        <div className="bg-white rounded-lg shadow">
          <h3 className="font-bold text-gray-800 p-4 border-b">Por Metodo de Pago</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">Metodo</th>
                <th className="text-right p-3 font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.incomeByMethod?.map((row, i) => (
                <tr key={i}>
                  <td className="p-3">{paymentMethodLabels[row.method] || row.method}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Services */}
        <div className="bg-white rounded-lg shadow">
          <h3 className="font-bold text-gray-800 p-4 border-b">Top Servicios</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">Servicio</th>
                <th className="text-center p-3 font-medium text-gray-600">Cantidad</th>
                <th className="text-right p-3 font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.topServices?.map((row, i) => (
                <tr key={i}>
                  <td className="p-3">{row.name}</td>
                  <td className="p-3 text-center">{row.count}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-lg shadow">
          <h3 className="font-bold text-gray-800 p-4 border-b">Top Productos</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">Producto</th>
                <th className="text-center p-3 font-medium text-gray-600">Cantidad</th>
                <th className="text-right p-3 font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.topProducts?.map((row, i) => (
                <tr key={i}>
                  <td className="p-3">{row.name}</td>
                  <td className="p-3 text-center">{row.count}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
