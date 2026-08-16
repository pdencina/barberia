"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Copy, ExternalLink, Globe, Clock, Building2, CreditCard } from "lucide-react";

const dayNames = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

interface DaySchedule {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export default function ConfiguracionPage() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [businessData, setBusinessData] = useState({
    name: "",
    address: "",
    phone: "",
    website: "",
  });
  const [hours, setHours] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // MercadoPago state
  const [mpToken, setMpToken] = useState("");
  const [mpDeviceId, setMpDeviceId] = useState("");
  const [mpDeviceName, setMpDeviceName] = useState("");
  const [mpConfigured, setMpConfigured] = useState(false);
  const [mpHasToken, setMpHasToken] = useState(false);
  const [mpSaving, setMpSaving] = useState(false);
  const [mpDevices, setMpDevices] = useState<Array<{ id: string; operating_mode: string }>>([]);
  const [mpDevicesNote, setMpDevicesNote] = useState("");
  const [mpLoadingDevices, setMpLoadingDevices] = useState(false);

  // Multi-terminal state
  interface Terminal { id: string; name: string; device_id: string; terminal_type: string; active: boolean; }
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [showAddTerminal, setShowAddTerminal] = useState(false);
  const [newTerminal, setNewTerminal] = useState({ name: "", device_id: "", terminal_type: "all" });

  // Generate time options from 06:00 to 23:00
  const timeOptions: string[] = [];
  for (let h = 6; h <= 23; h++) {
    timeOptions.push(`${h.toString().padStart(2, "0")}:00`);
    timeOptions.push(`${h.toString().padStart(2, "0")}:30`);
  }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch tenant info
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profile?.tenant_id) {
        setTenantId(profile.tenant_id);
        const { data: tenant } = await supabase
          .from("tenants")
          .select("name, slug, address, phone")
          .eq("id", profile.tenant_id)
          .single();

        if (tenant) {
          setBusinessData({
            name: tenant.name || "",
            address: tenant.address || "",
            phone: tenant.phone || "",
            website: "",
          });
          setTenantSlug(tenant.slug || null);
        }

        // Fetch MP settings
        const mpRes = await fetch(`/api/settings/mercadopago?tenantId=${profile.tenant_id}`);
        const mpData = await mpRes.json();
        if (mpData) {
          setMpToken(mpData.mp_access_token || "");
          setMpDeviceId(mpData.mp_device_id || "");
          setMpDeviceName(mpData.mp_device_name || "");
          setMpConfigured(mpData.mp_configured || false);
          setMpHasToken(mpData.has_token || false);
        }

        // Fetch terminals
        const termRes = await fetch(`/api/settings/mercadopago/terminals?tenantId=${profile.tenant_id}`);
        const termData = await termRes.json();
        if (Array.isArray(termData)) setTerminals(termData);
      }
    }

    // Fetch business hours
    const { data: hoursData } = await supabase
      .from("business_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .order("day_of_week");

    if (hoursData && hoursData.length > 0) {
      setHours(hoursData.map((h) => ({
        day_of_week: h.day_of_week,
        open_time: h.open_time?.slice(0, 5) || "10:00",
        close_time: h.close_time?.slice(0, 5) || "21:00",
        is_closed: h.is_closed || false,
      })));
    } else {
      // Default
      setHours(dayNames.map((_, i) => ({
        day_of_week: i,
        open_time: "10:00",
        close_time: "21:00",
        is_closed: i === 0,
      })));
    }

    setLoading(false);
  };

  const updateDay = (dayIndex: number, field: keyof DaySchedule, value: any) => {
    setHours((prev) =>
      prev.map((h) => h.day_of_week === dayIndex ? { ...h, [field]: value } : h)
    );
  };

  const handleSave = async () => {
    setSaving(true);

    // Save business hours
    for (const day of hours) {
      await supabase
        .from("business_hours")
        .upsert({
          day_of_week: day.day_of_week,
          open_time: day.open_time,
          close_time: day.close_time,
          is_closed: day.is_closed,
        }, { onConflict: "day_of_week" });
    }

    // Save tenant data
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profile?.tenant_id) {
        await supabase
          .from("tenants")
          .update({
            name: businessData.name,
            address: businessData.address,
            phone: businessData.phone,
          })
          .eq("id", profile.tenant_id);
      }
    }

    setSaving(false);
    showToast("Configuracion guardada", "success");
  };

  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/booking`
    : "re-booking.cl/booking";

  const copyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    showToast("Link copiado!", "success");
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in max-w-3xl">
      <h1 className="text-xl md:text-2xl font-bold text-brand-dark">Configuracion</h1>

      {/* Booking Link */}
      <div className="bg-gradient-to-r from-brand-blue/5 to-brand-accent/5 rounded-2xl border border-brand-blue/20 p-4 md:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-brand-blue" />
          <h2 className="font-bold text-brand-dark">Link de Reserva Online</h2>
        </div>
        <p className="text-sm text-brand-gray">
          Comparte este link para que tus clientes agenden directamente. Aparecen todos los profesionales disponibles.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono text-brand-dark truncate">
            {bookingUrl}
          </div>
          <button onClick={copyLink}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-brand-blue/90 transition-colors">
            <Copy className="w-4 h-4" />
            Copiar
          </button>
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
            className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <ExternalLink className="w-4 h-4 text-brand-gray" />
          </a>
        </div>
        <p className="text-xs text-brand-gray">
          Cada profesional tambien tiene su link personal en su perfil (seccion Profesionales).
        </p>
      </div>

      {/* Business Data */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-brand-gray" />
          <h2 className="font-bold text-brand-dark">Datos del Negocio</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-brand-gray mb-1">Nombre</label>
            <input type="text" value={businessData.name}
              onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-gray mb-1">Telefono</label>
            <input type="text" value={businessData.phone}
              onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })}
              placeholder="+56 9 1234 5678"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-brand-gray mb-1">Direccion</label>
            <input type="text" value={businessData.address}
              onChange={(e) => setBusinessData({ ...businessData, address: e.target.value })}
              placeholder="Av. Concha y Toro 123, Puente Alto"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-brand-gray mb-1">Sitio Web</label>
            <input type="text" value={businessData.website}
              onChange={(e) => setBusinessData({ ...businessData, website: e.target.value })}
              placeholder="https://www.estudiolevels.cl"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
          </div>
        </div>
      </div>

      {/* Per-day Schedule */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-brand-gray" />
          <div>
            <h2 className="font-bold text-brand-dark">Horario del Negocio</h2>
            <p className="text-xs text-brand-gray">Configura el horario de apertura y cierre por cada dia de la semana</p>
          </div>
        </div>

        <div className="space-y-2">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[140px_1fr_1fr_80px] gap-3 px-3 py-1">
            <span className="text-xs font-medium text-brand-gray">Dia</span>
            <span className="text-xs font-medium text-brand-gray">Apertura</span>
            <span className="text-xs font-medium text-brand-gray">Cierre</span>
            <span className="text-xs font-medium text-brand-gray text-center">Estado</span>
          </div>

          {/* Reorder: Monday first (1,2,3,4,5,6,0) */}
          {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
            const day = hours.find((h) => h.day_of_week === dayIndex);
            if (!day) return null;
            return (
              <div key={dayIndex}
                className={`grid grid-cols-1 md:grid-cols-[140px_1fr_1fr_80px] gap-2 md:gap-3 items-center p-3 rounded-xl border transition-colors ${
                  day.is_closed ? "bg-gray-50 border-gray-100 opacity-60" : "bg-white border-gray-200"
                }`}>
                {/* Day name */}
                <div className="flex items-center justify-between md:justify-start">
                  <span className={`text-sm font-medium ${day.is_closed ? "text-brand-gray" : "text-brand-dark"}`}>
                    {dayNames[dayIndex]}
                  </span>
                  {/* Mobile toggle */}
                  <button onClick={() => updateDay(dayIndex, "is_closed", !day.is_closed)}
                    className="md:hidden text-xs px-2 py-1 rounded-lg border border-gray-200">
                    {day.is_closed ? "Cerrado" : "Abierto"}
                  </button>
                </div>

                {/* Open time */}
                <select value={day.open_time}
                  disabled={day.is_closed}
                  onChange={(e) => updateDay(dayIndex, "open_time", e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                  {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>

                {/* Close time */}
                <select value={day.close_time}
                  disabled={day.is_closed}
                  onChange={(e) => updateDay(dayIndex, "close_time", e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                  {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>

                {/* Desktop toggle */}
                <div className="hidden md:flex justify-center">
                  <button onClick={() => updateDay(dayIndex, "is_closed", !day.is_closed)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      day.is_closed ? "bg-gray-300" : "bg-brand-blue"
                    }`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      day.is_closed ? "left-0.5" : "left-[22px]"
                    }`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-brand-gray">
          Los profesionales pueden tener horarios propios que sobreescriben este horario general (configurable en cada perfil).
        </p>
      </div>

      {/* MercadoPago Config */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-500" />
          <div>
            <h2 className="font-bold text-brand-dark">MercadoPago Point</h2>
            <p className="text-xs text-brand-gray">Configura tus maquinas de cobro para recibir pagos desde el POS</p>
          </div>
          {(mpConfigured || terminals.length > 0) && (
            <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">CONECTADO</span>
          )}
        </div>

        <div className="space-y-4">
          {/* Access Token */}
          <div>
            <label className="block text-xs font-medium text-brand-gray mb-1">Access Token (Produccion)</label>
            <input
              type="password"
              value={mpToken}
              onChange={(e) => setMpToken(e.target.value)}
              placeholder="APP_USR-xxxxxxxx-xxxx-xxxx..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono"
            />
            <p className="text-[10px] text-brand-gray mt-1">
              Obtenlo en <a href="https://www.mercadopago.cl/developers/panel/app" target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">mercadopago.cl/developers</a> → Tu aplicacion → Credenciales de produccion
            </p>
          </div>

          {/* Save Token */}
          <button
            onClick={async () => {
              if (!tenantId) return;
              setMpSaving(true);
              await fetch("/api/settings/mercadopago", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenantId, mp_access_token: mpToken, mp_device_id: mpDeviceId, mp_device_name: mpDeviceName }),
              });
              setMpSaving(false);
              setMpConfigured(true);
              setMpHasToken(true);
              showToast("Token guardado", "success");
            }}
            disabled={mpSaving || !mpToken}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {mpSaving ? "Guardando..." : "Guardar Token"}
          </button>

          {/* Terminals Section */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-brand-dark">Terminales</p>
                <p className="text-[10px] text-brand-gray">Agrega multiples maquinas y asigna cuales cobran servicios y cuales productos</p>
              </div>
              <button
                onClick={() => setShowAddTerminal(true)}
                className="px-3 py-1.5 bg-brand-blue text-white text-xs rounded-lg hover:bg-brand-blue/90 font-medium"
              >
                + Anadir terminal
              </button>
            </div>

            {/* Terminal list */}
            {terminals.length > 0 ? (
              <div className="space-y-2">
                {terminals.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-dark truncate">{t.name}</p>
                      <p className="text-[10px] font-mono text-brand-gray truncate">{t.device_id}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${
                      t.terminal_type === "services" ? "bg-purple-100 text-purple-700" :
                      t.terminal_type === "products" ? "bg-orange-100 text-orange-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {t.terminal_type === "services" ? "SERVICIOS" :
                       t.terminal_type === "products" ? "PRODUCTOS" : "TODO"}
                    </span>
                    <button
                      onClick={async () => {
                        if (!confirm(`Eliminar terminal "${t.name}"?`)) return;
                        await fetch(`/api/settings/mercadopago/terminals?id=${t.id}`, { method: "DELETE" });
                        setTerminals((prev) => prev.filter((x) => x.id !== t.id));
                        showToast("Terminal eliminado", "success");
                      }}
                      className="text-red-400 hover:text-red-600 text-xs flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-sm text-brand-gray">No hay terminales configurados</p>
                <p className="text-[10px] text-brand-gray mt-1">Agrega una maquina para empezar a cobrar con MercadoPago</p>
              </div>
            )}
          </div>

          {/* Add Terminal Form */}
          {showAddTerminal && (
            <div className="border border-brand-blue/20 bg-brand-blue/5 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-brand-dark">Nuevo Terminal</p>
              <div>
                <label className="block text-[10px] text-brand-gray mb-1">Nombre</label>
                <input
                  type="text"
                  value={newTerminal.name}
                  onChange={(e) => setNewTerminal({ ...newTerminal, name: e.target.value })}
                  placeholder="Ej: Maquina Servicios"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] text-brand-gray mb-1">Device ID</label>
                <input
                  type="text"
                  value={newTerminal.device_id}
                  onChange={(e) => setNewTerminal({ ...newTerminal, device_id: e.target.value })}
                  placeholder="NEWLAND_N950__SERIAL"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-brand-gray mb-1">Tipo de cobro</label>
                <select
                  value={newTerminal.terminal_type}
                  onChange={(e) => setNewTerminal({ ...newTerminal, terminal_type: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">Todo (servicios + productos)</option>
                  <option value="services">Solo Servicios (exento IVA)</option>
                  <option value="products">Solo Productos (afecto IVA)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowAddTerminal(false); setNewTerminal({ name: "", device_id: "", terminal_type: "all" }); }}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-brand-gray hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!tenantId || !newTerminal.name || !newTerminal.device_id) {
                      showToast("Completa nombre y Device ID", "error"); return;
                    }
                    const res = await fetch("/api/settings/mercadopago/terminals", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tenantId, ...newTerminal }),
                    });
                    const data = await res.json();
                    if (data.id) {
                      setTerminals((prev) => [...prev, data]);
                      setShowAddTerminal(false);
                      setNewTerminal({ name: "", device_id: "", terminal_type: "all" });
                      showToast("Terminal agregado", "success");
                    } else {
                      showToast(data.error || "Error", "error");
                    }
                  }}
                  disabled={!newTerminal.name || !newTerminal.device_id}
                  className="flex-1 py-2 bg-brand-blue text-white rounded-lg text-sm font-medium hover:bg-brand-blue/90 disabled:opacity-50"
                >
                  Agregar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="px-8 py-3 bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-blue/90 transition-colors disabled:opacity-50 shadow-sm">
          {saving ? "Guardando..." : "Guardar Configuracion"}
        </button>
      </div>
    </div>
  );
}
