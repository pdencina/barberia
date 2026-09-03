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
    tip_amount?: number;
    barber_id?: string | null;
    barberName?: string | null;
    services?: string;
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

  // Filter the daily movements by professional.
  const [barberFilter, setBarberFilter] = useState<string>("all");

  // Manual movement (register a sale by hand when a card charge went through but
  // re-booking didn't record it). Gated by admin PIN.
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({ barberId: "", serviceName: "", amount: "", paymentMethod: "debit_card", tip: "", notes: "", pin: "" });
  const [manualSaving, setManualSaving] = useState(false);
  const [barbers, setBarbers] = useState<Array<{ id: string; name: string }>>([]);

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
    const t = getActiveTenantId();
    fetch(`/api/barberos${t ? `?tenantId=${t}` : ""}`)
      .then((r) => r.json())
      .then((d) => setBarbers(Array.isArray(d) ? d : []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantLoading, tenant?.id]);

  const submitManualMovement = async () => {
    if (!manualForm.serviceName.trim() || !manualForm.amount || manualForm.pin.length < 4) {
      showToast("Completa servicio, monto y PIN", "error");
      return;
    }
    setManualSaving(true);
    const res = await fetch("/api/caja/manual-movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: getActiveTenantId(),
        barberId: manualForm.barberId || null,
        serviceName: manualForm.serviceName,
        amount: manualForm.amount,
        paymentMethod: manualForm.paymentMethod,
        tip: manualForm.tip,
        notes: manualForm.notes,
        pin: manualForm.pin,
      }),
    });
    const data = await res.json();
    setManualSaving(false);
    if (res.ok) {
      showToast("Movimiento registrado", "success");
      setShowManualModal(false);
      setManualForm({ barberId: "", serviceName: "", amount: "", paymentMethod: "debit_card", tip: "", notes: "", pin: "" });
      fetchData();
    } else {
      showToast(data.error || "No se pudo registrar", "error");
    }
  };

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

          {/* Transaction list — full breakdown for daily reconciliation */}
          {(() => {
            const filtered = data.transactions.filter((t) =>
              barberFilter === "all" ? true : (t.barber_id || "none") === barberFilter
            );
            // Barbers that actually have movements today, for the filter dropdown.
            const barbersWithMovements = Array.from(
              new Map(
                data.transactions
                  .filter((t) => t.barberName)
                  .map((t) => [t.barber_id, t.barberName])
              ).entries()
            ) as [string, string][];

            return (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold text-gray-800">Movimientos del Dia ({filtered.length})</h3>
                  <div className="flex items-center gap-2">
                    {barbersWithMovements.length > 0 && (
                      <select value={barberFilter} onChange={(e) => setBarberFilter(e.target.value)}
                        className="border rounded-lg px-2 py-1.5 text-xs">
                        <option value="all">Todos los profesionales</option>
                        {barbersWithMovements.map(([id, name]) => (
                          <option key={id} value={id}>{name}</option>
                        ))}
                      </select>
                    )}
                    <button onClick={() => setShowManualModal(true)}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 font-medium">
                      + Registrar movimiento
                    </button>
                  </div>
                </div>
                {filtered.length === 0 ? (
                  <p className="p-6 text-center text-gray-400">Sin movimientos</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead className="bg-gray-50 border-b text-left">
                        <tr>
                          <th className="p-3 font-medium text-gray-600">Profesional</th>
                          <th className="p-3 font-medium text-gray-600">Hora</th>
                          <th className="p-3 font-medium text-gray-600">Servicio</th>
                          <th className="p-3 font-medium text-gray-600 text-right">Precio</th>
                          <th className="p-3 font-medium text-gray-600">Metodo</th>
                          <th className="p-3 font-medium text-gray-600 text-right">Propina</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filtered.map((t) => (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.type === "income" ? "bg-green-500" : "bg-red-500"}`} />
                                {t.barberName || <span className="text-gray-400">—</span>}
                              </div>
                            </td>
                            <td className="p-3 text-gray-500">
                              {new Date(t.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="p-3">{t.services || t.notes || (t.type === "income" ? "Venta" : "Gasto")}</td>
                            <td className={`p-3 text-right font-medium ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                              {t.type === "income" ? "+" : "-"}{formatCurrency(Number(t.total))}
                            </td>
                            <td className="p-3 text-gray-600">{paymentLabels[t.payment_method] || t.payment_method}</td>
                            <td className="p-3 text-right text-gray-600">{t.tip_amount ? formatCurrency(Number(t.tip_amount)) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* Manual movement modal — for a card charge that went through but re-booking
          didn't record. Requires admin PIN. */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowManualModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-brand-dark mb-1">Registrar movimiento manual</h3>
            <p className="text-sm text-brand-gray mb-4">Usa esto si la maquina cobro pero la venta no quedo registrada. Requiere PIN de administrador.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Profesional</label>
                <select value={manualForm.barberId} onChange={(e) => setManualForm({ ...manualForm, barberId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Sin asignar</option>
                  {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Servicio</label>
                <input type="text" value={manualForm.serviceName} onChange={(e) => setManualForm({ ...manualForm, serviceName: e.target.value })}
                  placeholder="Ej: Corte, Corte y barba" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Precio ($)</label>
                  <input type="number" min="0" value={manualForm.amount} onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                    placeholder="15000" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Propina ($)</label>
                  <input type="number" min="0" value={manualForm.tip} onChange={(e) => setManualForm({ ...manualForm, tip: e.target.value })}
                    placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Metodo de pago</label>
                <select value={manualForm.paymentMethod} onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="debit_card">Debito</option>
                  <option value="credit_card">Credito</option>
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Notas (opcional)</label>
                <input type="text" value={manualForm.notes} onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  placeholder="Ej: fallo el pago en maquina, cobrado igual" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">PIN de administrador</label>
                <input type="password" inputMode="numeric" maxLength={6} value={manualForm.pin}
                  onChange={(e) => setManualForm({ ...manualForm, pin: e.target.value.replace(/\D/g, "") })}
                  placeholder="••••" className="w-full border rounded-lg px-3 py-2 text-center tracking-widest" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowManualModal(false)}
                  className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
                <button onClick={submitManualMovement} disabled={manualSaving}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {manualSaving ? "Registrando..." : "Registrar"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
