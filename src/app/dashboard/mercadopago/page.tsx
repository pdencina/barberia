"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";

interface Terminal {
  id: string;
  name: string;
  workMode: string;
  hasToken: boolean;
  deviceId: string | null;
  externalId: string | null;
}

export default function MercadoPagoPage() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formToken, setFormToken] = useState("");
  const [formDeviceId, setFormDeviceId] = useState("");
  const [formExternalId, setFormExternalId] = useState("");
  const { showToast } = useToast();

  const fetchTerminals = async () => {
    setLoading(true);
    const res = await fetch("/api/mercadopago/terminals");
    const data = await res.json();
    setTerminals(data.terminals || []);
    setLoading(false);
  };

  useEffect(() => { fetchTerminals(); }, []);

  const saveTerminal = async (barberId: string) => {
    const res = await fetch("/api/mercadopago/terminals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barberId,
        accessToken: formToken,
        deviceId: formDeviceId,
        externalId: formExternalId,
      }),
    });
    if (res.ok) {
      showToast("Terminal actualizado", "success");
      setEditingId(null);
      setFormToken(""); setFormDeviceId(""); setFormExternalId("");
      fetchTerminals();
    } else {
      showToast("Error al guardar", "error");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">MercadoPago - Terminales</h1>
        <p className="text-sm text-gray-500">Configura un terminal Point por cada profesional en arriendo</p>
      </div>

      {/* House terminal */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl shadow-lg shadow-blue-500/20 p-5 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">🏠</div>
          <div>
            <p className="font-bold">Terminal de la Casa</p>
            <p className="text-xs opacity-80">Profesionales en comisión comparten este terminal</p>
          </div>
        </div>
        <div className="mt-3 bg-white/10 rounded-xl p-3">
          <p className="text-xs opacity-70">Estado: {process.env.NEXT_PUBLIC_MP_CONFIGURED === "true" ? "✓ Configurado" : "Configurar en variables de entorno"}</p>
          <p className="text-[10px] opacity-50 mt-1">MP_ACCESS_TOKEN, MP_DEVICE_ID (env vars)</p>
        </div>
      </div>

      {/* Per-barber terminals */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3">Terminales personales (arriendo)</h2>
        {loading ? (
          <p className="text-gray-400 text-sm">Cargando...</p>
        ) : terminals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <p className="text-gray-400">No hay profesionales en modalidad arriendo</p>
            <p className="text-xs text-gray-500 mt-1">Cambia la modalidad en Profesionales para asignar terminales</p>
          </div>
        ) : (
          <div className="space-y-3">
            {terminals.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${t.hasToken ? "bg-green-500" : "bg-gray-300"}`} />
                    <div>
                      <p className="font-bold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">
                        {t.hasToken ? `Device: ${t.deviceId || "Sin device"}` : "Sin terminal configurado"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditingId(editingId === t.id ? null : t.id);
                      setFormToken(""); setFormDeviceId(t.deviceId || ""); setFormExternalId(t.externalId || "");
                    }}
                    className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
                  >
                    {editingId === t.id ? "Cancelar" : "Configurar"}
                  </button>
                </div>

                {editingId === t.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Access Token (MP del barbero)</label>
                      <input
                        type="password"
                        value={formToken}
                        onChange={(e) => setFormToken(e.target.value)}
                        placeholder="APP_USR-..."
                        className="w-full border rounded-xl px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Device ID</label>
                        <input
                          type="text"
                          value={formDeviceId}
                          onChange={(e) => setFormDeviceId(e.target.value)}
                          placeholder="GERTEC__..."
                          className="w-full border rounded-xl px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">External ID</label>
                        <input
                          type="text"
                          value={formExternalId}
                          onChange={(e) => setFormExternalId(e.target.value)}
                          placeholder="terminal-enzo"
                          className="w-full border rounded-xl px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => saveTerminal(t.id)}
                      disabled={!formDeviceId}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50"
                    >
                      Guardar Terminal
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-gray-50 rounded-2xl p-4 text-xs text-gray-600 space-y-2">
        <p className="font-bold text-gray-700">Como funciona:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Barbero en comision:</strong> usa el terminal de la casa (compartido)</li>
          <li><strong>Barbero en arriendo:</strong> tiene su propio terminal Point vinculado a su cuenta MP</li>
          <li>Al seleccionar un barbero en el POS, se activa automaticamente su terminal</li>
          <li>El cobro queda registrado en la cuenta MP del barbero correspondiente</li>
        </ul>
      </div>
    </div>
  );
}
