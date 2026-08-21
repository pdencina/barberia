"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";

interface HouseTerminal {
  id: string;
  name: string;
  access_token: string | null;
  device_id: string | null;
  active: boolean;
}

interface BarberTerminal {
  id: string;
  name: string;
  workMode: string;
  hasToken: boolean;
  deviceId: string | null;
}

export default function MercadoPagoPage() {
  const [houseTerminal, setHouseTerminal] = useState<HouseTerminal | null>(null);
  const [barberTerminals, setBarberTerminals] = useState<BarberTerminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingHouse, setEditingHouse] = useState(false);
  const [editingBarber, setEditingBarber] = useState<string | null>(null);
  const [houseToken, setHouseToken] = useState("");
  const [houseDevice, setHouseDevice] = useState("");
  const [barberToken, setBarberToken] = useState("");
  const [barberDevice, setBarberDevice] = useState("");
  const { showToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [houseRes, barbersRes] = await Promise.all([
      fetch("/api/mercadopago/config"),
      fetch("/api/mercadopago/terminals"),
    ]);
    const houseData = await houseRes.json();
    const barbersData = await barbersRes.json();
    setHouseTerminal(houseData.config || null);
    setBarberTerminals(barbersData.terminals || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const saveHouseTerminal = async () => {
    const res = await fetch("/api/mercadopago/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: houseToken, deviceId: houseDevice }),
    });
    if (res.ok) {
      showToast("Terminal de la Casa configurado", "success");
      setEditingHouse(false);
      fetchData();
    } else {
      showToast("Error al guardar", "error");
    }
  };

  const saveBarberTerminal = async (barberId: string) => {
    const res = await fetch("/api/mercadopago/terminals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barberId, accessToken: barberToken, deviceId: barberDevice }),
    });
    if (res.ok) {
      showToast("Terminal configurado", "success");
      setEditingBarber(null);
      setBarberToken("");
      setBarberDevice("");
      fetchData();
    }
  };

  const testConnection = async () => {
    const res = await fetch("/api/mercadopago/devices");
    const data = await res.json();
    if (data.orders_api_status === 201 || data.devices) {
      showToast("Conexion exitosa! La maquina responde.", "success");
    } else {
      showToast("Error de conexion: " + (data.error || "revisa credenciales"), "error");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-brand-dark">MercadoPago — Terminales</h1>
        <p className="text-sm text-brand-gray">Configura los terminales Point para cobrar desde el POS</p>
      </div>

      {/* House Terminal */}
      <div className="bg-gradient-to-br from-[#0F8B8D] to-[#0a6b6d] rounded-2xl shadow-lg p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">🏠</div>
            <div>
              <p className="font-bold">Terminal de la Casa</p>
              <p className="text-xs opacity-80">Profesionales en comision comparten este terminal</p>
            </div>
          </div>
          <button onClick={testConnection} className="px-3 py-1.5 bg-white/20 rounded-lg text-xs hover:bg-white/30">
            Probar conexion
          </button>
        </div>

        {houseTerminal?.device_id ? (
          <div className="bg-white/10 rounded-xl p-3 mt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-70">Device ID</p>
                <p className="text-sm font-mono">{houseTerminal.device_id}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs opacity-80">Configurado</span>
              </div>
            </div>
            <button onClick={() => { setEditingHouse(true); setHouseToken(houseTerminal.access_token || ""); setHouseDevice(houseTerminal.device_id || ""); }}
              className="mt-2 text-xs underline opacity-70 hover:opacity-100">Editar</button>
          </div>
        ) : (
          <div className="bg-white/10 rounded-xl p-3 mt-3">
            <p className="text-xs opacity-70 mb-2">Sin configurar — agrega las credenciales de MercadoPago</p>
            <button onClick={() => setEditingHouse(true)}
              className="px-4 py-2 bg-white text-[#0F8B8D] rounded-lg text-sm font-medium hover:bg-white/90">
              Configurar Terminal
            </button>
          </div>
        )}

        {editingHouse && (
          <div className="mt-4 bg-white/10 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs opacity-70 block mb-1">Access Token (APP_USR-...)</label>
              <input type="password" value={houseToken} onChange={(e) => setHouseToken(e.target.value)}
                placeholder="APP_USR-..."
                className="w-full rounded-lg px-3 py-2 text-sm text-brand-dark bg-white" />
            </div>
            <div>
              <label className="text-xs opacity-70 block mb-1">Device ID (NEWLAND_... o GERTEC_...)</label>
              <input type="text" value={houseDevice} onChange={(e) => setHouseDevice(e.target.value)}
                placeholder="NEWLAND_N950__..."
                className="w-full rounded-lg px-3 py-2 text-sm text-brand-dark bg-white" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingHouse(false)} className="px-3 py-2 bg-white/20 rounded-lg text-xs">Cancelar</button>
              <button onClick={saveHouseTerminal} disabled={!houseDevice}
                className="px-4 py-2 bg-white text-[#0F8B8D] rounded-lg text-sm font-medium disabled:opacity-50">
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Per-barber terminals */}
      <div>
        <h2 className="text-sm font-bold text-brand-dark mb-3">Terminales por Profesional</h2>
        <p className="text-xs text-brand-gray mb-4">Asigna un terminal diferente a un profesional especifico. Si no tiene, usa el de la casa.</p>

        {loading ? (
          <p className="text-brand-gray text-sm">Cargando...</p>
        ) : barberTerminals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <p className="text-brand-gray text-sm">Todos los profesionales usan el Terminal de la Casa</p>
            <p className="text-xs text-brand-gray mt-1">Para asignar terminales individuales, configura la modalidad "Arriendo" en Profesionales</p>
          </div>
        ) : (
          <div className="space-y-3">
            {barberTerminals.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${t.hasToken ? "bg-green-500" : "bg-gray-300"}`} />
                    <div>
                      <p className="font-bold text-brand-dark">{t.name}</p>
                      <p className="text-xs text-brand-gray">
                        {t.hasToken ? `Device: ${t.deviceId || "Sin device"}` : "Usa terminal de la casa"}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => { setEditingBarber(editingBarber === t.id ? null : t.id); setBarberDevice(t.deviceId || ""); setBarberToken(""); }}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-brand-gray">
                    {editingBarber === t.id ? "Cancelar" : "Configurar"}
                  </button>
                </div>

                {editingBarber === t.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div>
                      <label className="text-xs text-brand-gray block mb-1">Access Token (si es diferente al de la casa)</label>
                      <input type="password" value={barberToken} onChange={(e) => setBarberToken(e.target.value)}
                        placeholder="Dejar vacio = usa el de la casa"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-brand-gray block mb-1">Device ID</label>
                      <input type="text" value={barberDevice} onChange={(e) => setBarberDevice(e.target.value)}
                        placeholder="NEWLAND_N950__..."
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <button onClick={() => saveBarberTerminal(t.id)} disabled={!barberDevice}
                      className="px-4 py-2 bg-brand-blue text-white text-sm rounded-xl hover:opacity-90 disabled:opacity-50">
                      Guardar Terminal
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-brand-light rounded-2xl p-5 text-xs text-brand-gray space-y-2">
        <p className="font-bold text-brand-dark text-sm">Como funciona:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Terminal de la Casa:</strong> se usa para todos los profesionales que no tienen terminal propio</li>
          <li><strong>Terminal por profesional:</strong> si un profesional tiene su propio Point, configura su Device ID aqui</li>
          <li><strong>En el POS:</strong> al seleccionar profesional y cobrar con tarjeta, se activa automaticamente SU terminal</li>
          <li><strong>Si no tiene terminal propio:</strong> se activa el de la casa</li>
        </ul>
      </div>
    </div>
  );
}
