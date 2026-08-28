"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useTenant } from "@/lib/tenant-context";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";

interface CajaData {
  register: any;
  isOpen: boolean;
  summary: {
    openingAmount: number;
    cashIncome: number;
    cashExpense: number;
    cardIncome: number;
    totalIncome: number;
    totalExpense: number;
    expectedCash: number;
    transactionCount: number;
  };
  transactions: Array<{
    id: string;
    type: string;
    total: number;
    payment_method: string;
    notes: string | null;
    created_at: string;
  }>;
}

const paymentLabels: Record<string, string> = {
  cash: "Efectivo", debit_card: "Debito", credit_card: "Credito", transfer: "Transfer",
};

export default function CajaPage() {
  const [data, setData] = useState<CajaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingAmount, setOpeningAmount] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { tenant, loading: tenantLoading } = useTenant();
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenPin, setReopenPin] = useState("");
  const [reopenError, setReopenError] = useState("");
  const [reopening, setReopening] = useState(false);

  const getActiveTenantId = () => {
    if (tenant?.id) return tenant.id;
    try {
      const stored = localStorage.getItem("tenant_override");
      if (stored) return JSON.parse(stored).tenantId;
    } catch {}
    return "";
  };

  const fetchData = async () => {
    setLoading(true);
    const t = getActiveTenantId();
    const res = await fetch(`/api/caja${t ? `?tenantId=${t}` : ""}`);
    setData(await res.json());
    setLoading(false);
  };

  const handleReopen = async () => {
    setReopenError("");
    if (reopenPin.length !== 4) { setReopenError("PIN de 4 digitos"); return; }
    setReopening(true);

    // Verify admin PIN
    const pinRes = await fetch("/api/pos/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: reopenPin }),
    });
    const pinData = await pinRes.json();

    if (!pinData.valid) {
      setReopenError("PIN incorrecto");
      setReopening(false);
      return;
    }

    // Reopen the register
    const res = await fetch("/api/caja/reopen", { method: "POST" });
    setReopening(false);

    if (res.ok) {
      showToast(`Caja reabierta por ${pinData.adminName}`, "success");
      setShowReopenModal(false);
      setReopenPin("");
      fetchData();
    } else {
      const err = await res.json();
      setReopenError(err.error || "Error al reabrir");
    }
  };

  useEffect(() => {
    if (tenantLoading) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantLoading, tenant?.id]);

  const openRegister = async () => {
    const res = await fetch("/api/caja", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingAmount: parseInt(openingAmount) || 0, tenantId: getActiveTenantId() || undefined }),
    });
    if (res.ok) {
      showToast("Caja abierta", "success");
      setOpeningAmount("");
      fetchData();
    } else {
      const err = await res.json();
      showToast(err.error || "Error", "error");
    }
  };

  const closeRegister = async () => {
    if (!closingAmount) {
      showToast("Ingresa el monto contado", "error");
      return;
    }

    const ok = await confirm({
      title: "Cerrar Caja",
      message: `Confirmas el cierre de caja con ${formatCurrency(parseInt(closingAmount))} contados?`,
      confirmText: "Cerrar Caja",
      variant: "warning",
    });
    if (!ok) return;

    const res = await fetch("/api/caja", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        closingAmount: parseInt(closingAmount),
        notes: closingNotes || null,
        tenantId: getActiveTenantId() || undefined,
      }),
    });

    if (res.ok) {
      showToast("Caja cerrada", "success");
      setClosingAmount("");
      setClosingNotes("");
      fetchData();
    } else {
      const err = await res.json();
      showToast(err.error || "Error", "error");
    }
  };

  if (loading) return <Spinner />;

  const today = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Caja Diaria</h1>
        <p className="text-gray-500 text-sm">{today}</p>
      </div>

      {/* Status */}
      <div className={`rounded-lg p-4 border-2 ${
        data?.isOpen ? "border-green-300 bg-green-50" :
        data?.register?.status === "closed" ? "border-gray-300 bg-gray-50" :
        "border-yellow-300 bg-yellow-50"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            data?.isOpen ? "bg-green-500 animate-pulse" :
            data?.register?.status === "closed" ? "bg-gray-400" :
            "bg-yellow-500"
          }`} />
          <span className="font-medium text-gray-800">
            {data?.isOpen ? "Caja Abierta" :
             data?.register?.status === "closed" ? "Caja Cerrada" :
             "Caja No Abierta"}
          </span>
          {data?.register?.status === "closed" && (
            <button onClick={() => setShowReopenModal(true)}
              className="ml-3 px-3 py-1 text-xs border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 font-medium">
              Reabrir caja
            </button>
          )}
          {data?.register?.opened_at && (
            <span className="text-xs text-gray-500 ml-auto">
              Abierta: {new Date(data.register.opened_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
              {data.register.closed_at && ` · Cerrada: ${new Date(data.register.closed_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          )}
        </div>
      </div>

      {/* Open register */}
      {!data?.register && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
          <h3 className="font-bold text-gray-800 mb-4">Abrir Caja</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Monto inicial en caja (efectivo)</label>
              <input type="number" min="0" step="1000" value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                placeholder="Ej: 50000"
                className="w-full border rounded-lg px-3 py-2" />
            </div>
            <button onClick={openRegister}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
              Abrir Caja
            </button>
          </div>
        </div>
      )}

      {/* Summary (when open or closed) */}
      {data?.register && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">Apertura</p>
              <p className="text-xl font-bold">{formatCurrency(data.summary.openingAmount)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">Ingresos Efectivo</p>
              <p className="text-xl font-bold text-green-600">+{formatCurrency(data.summary.cashIncome)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">Egresos Efectivo</p>
              <p className="text-xl font-bold text-red-600">-{formatCurrency(data.summary.cashExpense)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center border-2 border-blue-200">
              <p className="text-xs text-gray-500 uppercase">Esperado en Caja</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(data.summary.expectedCash)}</p>
            </div>
          </div>

          {/* Additional stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">Ventas Tarjeta</p>
              <p className="text-lg font-bold text-purple-600">{formatCurrency(data.summary.cardIncome)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">Total Ventas</p>
              <p className="text-lg font-bold">{formatCurrency(data.summary.totalIncome)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">Operaciones</p>
              <p className="text-lg font-bold">{data.summary.transactionCount}</p>
            </div>
          </div>

          {/* Close register */}
          {data.isOpen && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 border-2 border-yellow-200">
              <h3 className="font-bold text-gray-800 mb-4">Cerrar Caja</h3>
              <p className="text-sm text-gray-500 mb-4">Cuenta el efectivo en caja y registra el monto.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Monto contado ($)</label>
                  <input type="number" min="0" step="100" value={closingAmount}
                    onChange={(e) => setClosingAmount(e.target.value)}
                    placeholder={String(data.summary.expectedCash)}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Notas (opcional)</label>
                  <input type="text" value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="Observaciones del cierre..."
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <button onClick={closeRegister}
                disabled={!closingAmount}
                className="mt-4 px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium disabled:opacity-50">
                Cerrar Caja
              </button>
            </div>
          )}

          {/* Closed result */}
          {data.register.status === "closed" && data.register.closing_amount !== null && (
            <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 border-2 ${
              Number(data.register.difference) === 0 ? "border-green-300" :
              Number(data.register.difference) > 0 ? "border-blue-300" : "border-red-300"
            }`}>
              <h3 className="font-bold text-gray-800 mb-3">Resultado del Cierre</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500">Esperado</p>
                  <p className="text-lg font-bold">{formatCurrency(Number(data.register.expected_amount))}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Contado</p>
                  <p className="text-lg font-bold">{formatCurrency(Number(data.register.closing_amount))}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Diferencia</p>
                  <p className={`text-lg font-bold ${
                    Number(data.register.difference) === 0 ? "text-green-600" :
                    Number(data.register.difference) > 0 ? "text-blue-600" : "text-red-600"
                  }`}>
                    {Number(data.register.difference) >= 0 ? "+" : ""}{formatCurrency(Number(data.register.difference))}
                  </p>
                </div>
              </div>
              {Number(data.register.difference) === 0 && (
                <p className="text-center text-green-600 font-medium mt-3">Caja cuadrada!</p>
              )}
              {Number(data.register.difference) > 0 && (
                <p className="text-center text-blue-600 text-sm mt-3">Sobrante de {formatCurrency(Number(data.register.difference))}</p>
              )}
              {Number(data.register.difference) < 0 && (
                <p className="text-center text-red-600 text-sm mt-3">Faltante de {formatCurrency(Math.abs(Number(data.register.difference)))}</p>
              )}
            </div>
          )}

          {/* Transaction list */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-800">Movimientos del Dia ({data.transactions.length})</h3>
            </div>
            {data.transactions.length === 0 ? (
              <p className="p-6 text-center text-gray-400">Sin movimientos</p>
            ) : (
              <div className="divide-y max-h-[300px] overflow-y-auto">
                {data.transactions.map((t) => (
                  <div key={t.id} className="p-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${t.type === "income" ? "bg-green-500" : "bg-red-500"}`} />
                      <div>
                        <span className="text-gray-700">{t.notes || (t.type === "income" ? "Venta" : "Gasto")}</span>
                        <span className="text-xs text-gray-400 ml-2">{paymentLabels[t.payment_method] || t.payment_method}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {new Date(t.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={`font-medium ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                        {t.type === "income" ? "+" : "-"}{formatCurrency(Number(t.total))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowReopenModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-brand-dark">Reabrir Caja</h3>
              <p className="text-sm text-brand-gray mt-1">Accion excepcional. Requiere PIN de administrador.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-brand-gray block mb-1">PIN Admin (4 digitos)</label>
                <input
                  type="password"
                  maxLength={4}
                  value={reopenPin}
                  onChange={(e) => { setReopenPin(e.target.value.replace(/\D/g, "")); setReopenError(""); }}
                  placeholder="••••"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && reopenPin.length === 4) handleReopen(); }}
                  className="w-full border-2 rounded-xl px-3 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:border-orange-400 outline-none"
                />
              </div>

              {reopenError && <p className="text-xs text-red-500 text-center">{reopenError}</p>}

              <div className="flex gap-2">
                <button onClick={() => { setShowReopenModal(false); setReopenPin(""); setReopenError(""); }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-brand-gray hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={handleReopen} disabled={reopenPin.length !== 4 || reopening}
                  className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                  {reopening ? "Reabriendo..." : "Confirmar reapertura"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
