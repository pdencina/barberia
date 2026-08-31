"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useTenant } from "@/lib/tenant-context";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";

interface RentalProfessional {
  id: string;
  name: string;
  dailyRate: number;
  daysWorked: number;
  autoCalculatedDays: number;
  grossAmount: number;
  deductions: number;
  productBonus: number;
  netAmount: number;
  paid: boolean;
  paidAt: string | null;
  notes: string | null;
  recordId: string | null;
}

const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function ArriendoPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [professionals, setProfessionals] = useState<RentalProfessional[]>([]);
  const [totals, setTotals] = useState({ totalGross: 0, totalNet: 0, totalProfessionals: 0 });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDays, setEditDays] = useState("");
  const [editDeductions, setEditDeductions] = useState("");
  const [editProductBonus, setEditProductBonus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { tenant, loading: tenantLoading } = useTenant();
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ barberId: "", amount: "", type: "addition", reason: "", pin: "" });
  const [adjusting, setAdjusting] = useState(false);

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
    const res = await fetch(`/api/arriendo?month=${month}&year=${year}${t ? `&tenantId=${t}` : ""}`);
    const data = await res.json();
    setProfessionals(data.professionals || []);
    setTotals(data.totals || { totalGross: 0, totalNet: 0, totalProfessionals: 0 });
    setLoading(false);
  };

  useEffect(() => {
    if (tenantLoading) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, tenantLoading, tenant?.id]);

  const changeMonth = (delta: number) => {
    let m = month + delta, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m); setYear(y);
  };

  const saveRecord = async (prof: RentalProfessional) => {
    await fetch("/api/arriendo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barberId: prof.id,
        month, year,
        daysWorked: parseInt(editDays) || prof.daysWorked,
        // Deductions and bonus both default to 0 (not the previous value) when the
        // field is cleared, so you can actually zero one out instead of it silently
        // falling back to the old amount.
        deductions: editDeductions === "" ? prof.deductions : parseInt(editDeductions) || 0,
        productBonus: editProductBonus === "" ? prof.productBonus : parseInt(editProductBonus) || 0,
        notes: editNotes || prof.notes,
      }),
    });
    showToast("Registro guardado", "success");
    setEditingId(null);
    fetchData();
  };

  const markPaid = async (prof: RentalProfessional) => {
    const ok = await confirm({
      title: "Marcar como pagado",
      message: `Confirmas el cobro de ${formatCurrency(prof.netAmount)} a ${prof.name}?`,
      confirmText: "Si, cobrado",
      variant: "warning",
    });
    if (!ok) return;

    await fetch("/api/arriendo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId: prof.recordId, barberId: prof.id, month, year }),
    });
    showToast(`Cobro registrado para ${prof.name}`, "success");
    fetchData();
  };

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Arriendo de Estación</h1>
          <p className="text-sm text-gray-500">Profesionales en modalidad arriendo de sillón</p>
        </div>
        <button onClick={() => setShowAdjustModal(true)}
          className="px-4 py-2 bg-orange-600 text-white text-sm rounded-xl hover:bg-orange-700 font-medium">
          Ajuste Manual
        </button>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-4">
        <button onClick={() => changeMonth(-1)} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">←</button>
        <span className="text-lg font-bold">{monthNames[month - 1]} {year}</span>
        <button onClick={() => changeMonth(1)} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">→</button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl shadow-lg shadow-orange-500/20 p-5 text-white">
          <p className="text-xs uppercase opacity-80">Total a Cobrar</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totals.totalNet)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase">Bruto (sin descuentos)</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.totalGross)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase">Profesionales en arriendo</p>
          <p className="text-xl font-bold text-gray-900">{totals.totalProfessionals}</p>
        </div>
      </div>

      {/* Empty state */}
      {!loading && professionals.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-gray-400 mb-2">No hay profesionales en modalidad arriendo</p>
          <p className="text-sm text-gray-500">Ve a Profesionales → click en un nombre → cambia la modalidad a "Arriendo"</p>
        </div>
      )}

      {/* Professionals */}
      {loading ? <Spinner /> : (
        <div className="space-y-4">
          {professionals.map((prof) => (
            <div key={prof.id} className={`bg-white rounded-2xl shadow-sm border p-5 ${prof.paid ? "border-green-200 bg-green-50/30" : "border-gray-100"}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">{prof.name}</h3>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(prof.dailyRate)}/día · {prof.daysWorked} días trabajados
                    {prof.autoCalculatedDays !== prof.daysWorked && (
                      <span className="text-orange-500 ml-1">(auto: {prof.autoCalculatedDays})</span>
                    )}
                  </p>
                </div>
                {prof.paid ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Cobrado</span>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => {
                      setEditingId(editingId === prof.id ? null : prof.id);
                      setEditDays(String(prof.daysWorked));
                      setEditDeductions(String(prof.deductions));
                      setEditProductBonus(String(prof.productBonus));
                      setEditNotes(prof.notes || "");
                    }} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">
                      {editingId === prof.id ? "Cancelar" : "Ajustar"}
                    </button>
                    <button onClick={() => markPaid(prof)}
                      className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                      Cobrar
                    </button>
                  </div>
                )}
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Días</p>
                  <p className="font-bold text-gray-900">{prof.daysWorked}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Bruto</p>
                  <p className="font-bold">{formatCurrency(prof.grossAmount)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Descuentos</p>
                  <p className="font-bold text-red-600">-{formatCurrency(prof.deductions)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Bono Productos</p>
                  <p className="font-bold text-green-600">+{formatCurrency(prof.productBonus)}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-200">
                  <p className="text-xs text-orange-600">Total</p>
                  <p className="font-bold text-orange-700">{formatCurrency(prof.netAmount)}</p>
                </div>
              </div>

              {/* Edit form */}
              {editingId === prof.id && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Días trabajados</label>
                      <input type="number" min="0" max="31" value={editDays}
                        onChange={(e) => setEditDays(e.target.value)}
                        className="w-full border rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-red-500 mb-1">Descuentos ($) — resta</label>
                      <input type="number" min="0" value={editDeductions}
                        onChange={(e) => setEditDeductions(e.target.value)}
                        className="w-full border rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-green-600 mb-1">Bono productos ($) — suma</label>
                      <input type="number" min="0" value={editProductBonus}
                        onChange={(e) => setEditProductBonus(e.target.value)}
                        className="w-full border rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Notas</label>
                      <input type="text" value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Observaciones..."
                        className="w-full border rounded-xl px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <button onClick={() => saveRecord(prof)}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700">
                    Guardar Ajuste
                  </button>
                </div>
              )}

              {prof.notes && !editingId && (
                <p className="text-xs text-gray-400 mt-2 italic">{prof.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Adjust Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAdjustModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-brand-dark mb-1">Ajuste Manual de Arriendo</h3>
            <p className="text-sm text-brand-gray mb-4">Agrega bonos, descuentos o corrige montos. Queda en auditoria.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-brand-gray block mb-1">Profesional</label>
                <select value={adjustForm.barberId} onChange={(e) => setAdjustForm({ ...adjustForm, barberId: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                  <option value="">Seleccionar...</option>
                  {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-gray block mb-1">Tipo</label>
                  <select value={adjustForm.type} onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                    <option value="addition">Bono / Agregar (+)</option>
                    <option value="deduction">Descuento / Deducir (-)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-brand-gray block mb-1">Monto ($)</label>
                  <input type="number" min="0" value={adjustForm.amount} onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
                    placeholder="5000" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-brand-gray block mb-1">Motivo *</label>
                <input type="text" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="Ej: Bono productos, descuento aseo, dia no cobrado..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-brand-gray block mb-1">PIN Admin</label>
                <input type="password" maxLength={4} value={adjustForm.pin}
                  onChange={(e) => setAdjustForm({ ...adjustForm, pin: e.target.value.replace(/\D/g, "") })}
                  placeholder="••••" className="w-full border border-gray-200 rounded-xl px-3 py-3 text-center text-xl tracking-[0.4em] font-mono" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAdjustModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-brand-gray hover:bg-gray-50">Cancelar</button>
                <button onClick={async () => {
                  if (!adjustForm.barberId || !adjustForm.amount || !adjustForm.reason || adjustForm.pin.length !== 4) {
                    showToast("Completa todos los campos", "error"); return;
                  }
                  setAdjusting(true);
                  const res = await fetch("/api/arriendo/adjust", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ barberId: adjustForm.barberId, month, year, amount: parseInt(adjustForm.amount), type: adjustForm.type, reason: adjustForm.reason, pin: adjustForm.pin }),
                  });
                  const data = await res.json();
                  setAdjusting(false);
                  if (res.ok) {
                    showToast(`Ajuste registrado por ${data.adjustedBy}`, "success");
                    setShowAdjustModal(false);
                    setAdjustForm({ barberId: "", amount: "", type: "addition", reason: "", pin: "" });
                    fetchData();
                  } else {
                    showToast(data.error || "Error", "error");
                  }
                }} disabled={adjusting || !adjustForm.barberId || !adjustForm.amount || !adjustForm.reason || adjustForm.pin.length !== 4}
                  className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                  {adjusting ? "Procesando..." : "Registrar Ajuste"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
