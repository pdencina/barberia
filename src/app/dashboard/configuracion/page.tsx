"use client";

import { useState } from "react";

export default function ConfiguracionPage() {
  const [businessData, setBusinessData] = useState({
    name: "EstudioLevels",
    address: "",
    phone: "",
    website: "",
  });
  const [schedule, setSchedule] = useState({
    open_time: "09:00",
    close_time: "20:00",
    slot_duration: "30",
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configuracion</h1>

      {/* Business Data */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="font-bold text-gray-800">Datos del Negocio</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input type="text" value={businessData.name}
            onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
          <input type="text" value={businessData.address}
            onChange={(e) => setBusinessData({ ...businessData, address: e.target.value })}
            className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
          <input type="text" value={businessData.phone}
            onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })}
            className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sitio Web</label>
          <input type="text" value={businessData.website}
            onChange={(e) => setBusinessData({ ...businessData, website: e.target.value })}
            className="w-full border rounded-lg px-3 py-2" />
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="font-bold text-gray-800">Horario</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hora Apertura</label>
            <input type="time" value={schedule.open_time}
              onChange={(e) => setSchedule({ ...schedule, open_time: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hora Cierre</label>
            <input type="time" value={schedule.close_time}
              onChange={(e) => setSchedule({ ...schedule, close_time: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duracion del Slot</label>
          <select value={schedule.slot_duration}
            onChange={(e) => setSchedule({ ...schedule, slot_duration: e.target.value })}
            className="w-full border rounded-lg px-3 py-2">
            <option value="15">15 minutos</option>
            <option value="30">30 minutos</option>
            <option value="45">45 minutos</option>
            <option value="60">60 minutos</option>
          </select>
        </div>
      </div>

      {/* Email Config */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="font-bold text-gray-800">Configuracion de Email</h2>
        <div className="bg-gray-50 border rounded-lg p-4">
          <p className="text-sm text-gray-600">
            La configuracion de email (SMTP) se realiza mediante variables de entorno.
            Configura las siguientes variables en tu archivo <code className="bg-gray-200 px-1 rounded">.env</code>:
          </p>
          <ul className="mt-2 text-sm text-gray-600 space-y-1">
            <li><code className="bg-gray-200 px-1 rounded">RESEND_API_KEY</code> - API key de Resend</li>
            <li><code className="bg-gray-200 px-1 rounded">EMAIL_FROM</code> - Email de origen</li>
          </ul>
        </div>
      </div>

      <button onClick={handleSave}
        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">
        {saved ? "Guardado!" : "Guardar Configuracion"}
      </button>
    </div>
  );
}
