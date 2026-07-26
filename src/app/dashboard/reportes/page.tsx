"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

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
  const [comparison, setComparison] = useState<Array<{ label: string; income: number; expenses: number }>>([]);

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

  useEffect(() => {
    fetch("/api/reportes/comparison")
      .then((r) => r.json())
      .then((d) => setComparison(Array.isArray(d) ? d : []));
  }, []);

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
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Reportes</h1>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Reportes</h1>
        <a
          href={`/api/reportes/pdf?month=${month}&year=${year}`}
          target="_blank"
          className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Descargar PDF
        </a>
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Ingresos</p>
          <p className="text-lg font-bold text-green-600">{formatCurrency(data.summary.totalIncome)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Egresos</p>
          <p className="text-lg font-bold text-red-600">{formatCurrency(data.summary.totalExpenses)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Utilidad</p>
          <p className="text-lg font-bold text-indigo-600">{formatCurrency(data.summary.netProfit)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Transacciones</p>
          <p className="text-lg font-bold text-gray-900">{data.summary.totalTransactions}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Citas</p>
          <p className="text-lg font-bold text-gray-900">{data.summary.appointmentsCompleted}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Clientes Nuevos</p>
          <p className="text-lg font-bold text-gray-900">{data.summary.newClients}</p>
        </div>
      </div>

      {/* Monthly Comparison Chart */}
      {comparison.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
          <h3 className="font-bold text-gray-800 mb-4">Comparativa Mensual (ultimos 6 meses)</h3>
          <div className="flex items-end justify-between gap-2 h-48">
            {comparison.map((m) => {
              const maxVal = Math.max(...comparison.map((c) => Math.max(c.income, c.expenses)), 1);
              const incomeHeight = (m.income / maxVal) * 100;
              const expenseHeight = (m.expenses / maxVal) * 100;
              return (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex gap-0.5 items-end h-36 w-full justify-center">
                    <div className="w-3 md:w-5 bg-green-400 rounded-t" style={{ height: `${Math.max(incomeHeight, 2)}%` }} title={`Ingresos: ${formatCurrency(m.income)}`} />
                    <div className="w-3 md:w-5 bg-red-300 rounded-t" style={{ height: `${Math.max(expenseHeight, 2)}%` }} title={`Egresos: ${formatCurrency(m.expenses)}`} />
                  </div>
                  <span className="text-[10px] text-gray-500">{m.label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 justify-center mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded" /> Ingresos</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-300 rounded" /> Egresos</span>
          </div>
        </div>
      )}

      {/* Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income by Barber */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
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
