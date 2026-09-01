"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { useTenant } from "@/lib/tenant-context";
import { Copy, ExternalLink, Globe, Clock, Building2, CreditCard, Image as ImageIcon, Lock } from "lucide-react";

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
  // Reliable tenant source (server-provided, same pattern used everywhere else in the
  // app). The old code below re-resolved the tenant via a client-side auth.getUser()
  // call, which is the unreliable-on-Vercel pattern that made the booking link fall
  // back to the generic /booking URL for some accounts (e.g. recepcion).
  const { tenant, loading: tenantCtxLoading } = useTenant();

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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Change password (self-service, avoids the destructive "Enviar credenciales" flow)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

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
  const [newTerminal, setNewTerminal] = useState({ name: "", device_id: "", terminal_type: "all", access_token: "" });

  // TUU (Haulmer) state — second card terminal provider, parallel to MercadoPago.
  // https://developers.tuu.cl/docs/pago-remoto
  interface TuuTerminal { id: string; name: string; device_serial: string; terminal_type: string; active: boolean; }
  const [cardProvider, setCardProvider] = useState<"mercadopago" | "tuu">("mercadopago");
  const [tuuApiKey, setTuuApiKey] = useState("");
  const [tuuConfigured, setTuuConfigured] = useState(false);
  const [tuuSaving, setTuuSaving] = useState(false);
  const [tuuTerminals, setTuuTerminals] = useState<TuuTerminal[]>([]);
  const [showAddTuuTerminal, setShowAddTuuTerminal] = useState(false);
  const [newTuuTerminal, setNewTuuTerminal] = useState({ name: "", device_serial: "", terminal_type: "all" });

  // Deposit/abono settings
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositPercentage, setDepositPercentage] = useState(30);
  const [cancellationHours, setCancellationHours] = useState(24);
  const [depositMessage, setDepositMessage] = useState("Este servicio requiere un abono para confirmar tu cita.");
  const [depositSaving, setDepositSaving] = useState(false);

  // Generate time options from 06:00 to 23:00
  const timeOptions: string[] = [];
  for (let h = 6; h <= 23; h++) {
    timeOptions.push(`${h.toString().padStart(2, "0")}:00`);
    timeOptions.push(`${h.toString().padStart(2, "0")}:30`);
  }

  useEffect(() => {
    if (tenantCtxLoading) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantCtxLoading, tenant?.id]);

  const fetchData = async () => {
    setLoading(true);

    // Resolve the tenant: prefer the reliable server-provided context; fall back to
    // resolving it from the client session only if the context has no tenant yet
    // (e.g. super_admin without an override).
    let resolvedTenantId = tenant?.id || null;
    if (!resolvedTenantId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();
        resolvedTenantId = profile?.tenant_id || null;
      }
    }

    if (resolvedTenantId) {
      setTenantId(resolvedTenantId);
      const currentTenantId = resolvedTenantId;
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("name, slug, address, phone, logo_url")
        .eq("id", resolvedTenantId)
        .single();

      if (tenantRow) {
        setBusinessData({
          name: tenantRow.name || "",
          address: tenantRow.address || "",
          phone: tenantRow.phone || "",
          website: "",
        });
        setTenantSlug(tenantRow.slug || null);
        setLogoUrl((tenantRow as any).logo_url || null);
      }

      {
        // Fetch MP settings
        const mpRes = await fetch(`/api/settings/mercadopago?tenantId=${resolvedTenantId}`);
        const mpData = await mpRes.json();
        if (mpData) {
          setMpToken(mpData.mp_access_token || "");
          setMpDeviceId(mpData.mp_device_id || "");
          setMpDeviceName(mpData.mp_device_name || "");
          setMpConfigured(mpData.mp_configured || false);
          setMpHasToken(mpData.has_token || false);
        }

        // Fetch terminals
        const termRes = await fetch(`/api/settings/mercadopago/terminals?tenantId=${resolvedTenantId}`);
        const termData = await termRes.json();
        if (Array.isArray(termData)) setTerminals(termData);

        // Fetch TUU settings + terminals
        const tuuRes = await fetch(`/api/settings/tuu?tenantId=${resolvedTenantId}`);
        const tuuData = await tuuRes.json();
        if (tuuData) {
          setTuuApiKey(tuuData.tuu_api_key || "");
          setTuuConfigured(tuuData.tuu_configured || false);
          setCardProvider(tuuData.card_payment_provider === "tuu" ? "tuu" : "mercadopago");
        }
        const tuuTermRes = await fetch(`/api/settings/tuu/terminals?tenantId=${resolvedTenantId}`);
        const tuuTermData = await tuuTermRes.json();
        if (Array.isArray(tuuTermData)) setTuuTerminals(tuuTermData);

        // Fetch deposit settings
        const depRes = await fetch(`/api/settings/deposit?tenantId=${resolvedTenantId}`);
        const depData = await depRes.json();
        if (depData) {
          setDepositEnabled(depData.deposit_enabled || false);
          setDepositPercentage(depData.deposit_percentage || 30);
          setCancellationHours(depData.cancellation_free_hours || 24);
          setDepositMessage(depData.deposit_message || "Este servicio requiere un abono para confirmar tu cita.");
        }
      }
    }

    // Fetch business hours for this tenant (use the resolved value directly, not the
    // tenantId state — setState above may not have flushed yet within this function).
    const hoursFilter = resolvedTenantId || null;
    let hoursQuery = supabase
      .from("business_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .order("day_of_week");
    if (hoursFilter) hoursQuery = hoursQuery.eq("tenant_id", hoursFilter);
    const { data: hoursData } = await hoursQuery;

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
          tenant_id: tenantId,
          day_of_week: day.day_of_week,
          open_time: day.open_time,
          close_time: day.close_time,
          is_closed: day.is_closed,
        }, { onConflict: "tenant_id,day_of_week" });
    }

    // Save tenant data (tenantId is already resolved reliably by fetchData)
    if (tenantId) {
      await supabase
        .from("tenants")
        .update({
          name: businessData.name,
          address: businessData.address,
          phone: businessData.phone,
        })
        .eq("id", tenantId);
    }

    setSaving(false);
    showToast("Configuracion guardada", "success");
  };

  const bookingUrl = typeof window !== "undefined"
    ? tenantSlug
      ? `${window.location.origin}/b/${tenantSlug}`
      : `${window.location.origin}/booking`
    : "re-booking.cl/booking";

  const copyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    showToast("Link copiado!", "success");
  };

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Silent no-op was the exact bug reported ("aparece la opcion pero no sube el
    // archivo"): if tenantId hadn't resolved yet (e.g. clicked right as the page
    // loaded), this used to return with zero feedback. Now it tells the user why.
    if (!tenantId) {
      showToast("Espera un momento a que cargue la pagina y vuelve a intentar.", "error");
      e.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      showToast("El archivo debe ser una imagen (jpg, png, etc.)", "error");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(`La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)}MB, el maximo es 5MB.`, "error");
      e.target.value = "";
      return;
    }
    setUploadingLogo(true);
    const form = new FormData();
    form.append("file", file);
    form.append("tenantId", tenantId);
    try {
      const res = await fetch("/api/settings/logo", { method: "POST", body: form });
      const result = await res.json();
      if (res.ok) {
        setLogoUrl(result.url);
        showToast("Logo actualizado", "success");
      } else {
        showToast(result.error || "Error al subir logo", "error");
      }
    } catch {
      showToast("Error al subir logo", "error");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const removeLogo = async () => {
    if (!tenantId) return;
    await fetch(`/api/settings/logo?tenantId=${tenantId}`, { method: "DELETE" });
    setLogoUrl(null);
    showToast("Logo eliminado", "success");
  };

  const handleChangePassword = async () => {
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Completa los 3 campos");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas nuevas no coinciden");
      return;
    }

    setChangingPassword(true);

    // Verify the current password by re-authenticating (updateUser alone would accept
    // any new password without checking the current one, since the session is already
    // active — we need this extra check so a stranger at an unlocked computer can't
    // just change the password without knowing it).
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      setPasswordError("No se pudo verificar tu sesion. Vuelve a iniciar sesion.");
      setChangingPassword(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      setPasswordError("La contraseña actual no es correcta");
      setChangingPassword(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    setChangingPassword(false);

    if (updateError) {
      setPasswordError(updateError.message || "Error al cambiar la contraseña");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    showToast("Contraseña actualizada", "success");
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

        {/* Logo del negocio: se muestra en la reserva online y en las boletas por correo
            en vez del logo generico de re-booking. */}
        <div className="flex items-center gap-4">
          <label className="relative group cursor-pointer flex-shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo del negocio" className="w-16 h-16 rounded-xl object-contain border border-gray-200 bg-white" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-gray-300" />
              </div>
            )}
            <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            {uploadingLogo && (
              <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
                <span className="text-[8px] text-white font-medium text-center">Subiendo...</span>
              </div>
            )}
            <input type="file" accept="image/*" onChange={uploadLogo} className="hidden" disabled={uploadingLogo} />
          </label>
          <div>
            <p className="text-sm font-medium text-brand-dark">Logo del negocio</p>
            <p className="text-xs text-brand-gray">Toca la imagen para subir tu logo. Se mostrara en la reserva online y en las boletas por correo.</p>
            {logoUrl && (
              <button onClick={removeLogo} className="text-xs text-red-500 hover:underline mt-1">Quitar logo</button>
            )}
          </div>
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
              Obtenlo en <a href="https://www.mercadopago.cl/developers/panel/app" target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">mercadopago.cl/developers</a> â†’ Tu aplicacion â†’ Credenciales de produccion
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
              <div>
                <label className="block text-[10px] text-brand-gray mb-1">Access Token (opcional, si tiene cuenta propia)</label>
                <input
                  type="password"
                  value={newTerminal.access_token}
                  onChange={(e) => setNewTerminal({ ...newTerminal, access_token: e.target.value })}
                  placeholder="Dejar vacio para usar el token global"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowAddTerminal(false); setNewTerminal({ name: "", device_id: "", terminal_type: "all", access_token: "" }); }}
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
                      setNewTerminal({ name: "", device_id: "", terminal_type: "all", access_token: "" });
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

      {/* TUU (Haulmer) Config — second card terminal provider, parallel to MercadoPago.
          Only one provider is active at a time per tenant (card_payment_provider),
          switching here changes which one the POS charges to; it never affects tenants
          that leave this untouched (default stays "mercadopago"). */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-500" />
          <div>
            <h2 className="font-bold text-brand-dark">TUU (Haulmer)</h2>
            <p className="text-xs text-brand-gray">Configura tu maquina TUU para recibir pagos desde el POS</p>
          </div>
          {(tuuConfigured || tuuTerminals.length > 0) && (
            <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">CONECTADO</span>
          )}
        </div>

        <div className="space-y-4">
          {/* Active provider selector */}
          <div>
            <label className="block text-xs font-medium text-brand-gray mb-1">Maquina que usa el POS para cobrar con tarjeta</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  if (!tenantId) return;
                  setCardProvider("mercadopago");
                  await fetch("/api/settings/tuu", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tenantId, card_payment_provider: "mercadopago" }),
                  });
                  showToast("El POS ahora cobra con MercadoPago", "success");
                }}
                className={`py-2 rounded-xl text-sm font-medium border ${cardProvider === "mercadopago" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-brand-gray border-gray-200 hover:bg-gray-50"}`}
              >
                MercadoPago
              </button>
              <button
                onClick={async () => {
                  if (!tenantId) return;
                  if (!tuuConfigured && tuuTerminals.length === 0) {
                    showToast("Primero guarda tu API Key y agrega una terminal TUU", "error");
                    return;
                  }
                  setCardProvider("tuu");
                  await fetch("/api/settings/tuu", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tenantId, card_payment_provider: "tuu" }),
                  });
                  showToast("El POS ahora cobra con TUU", "success");
                }}
                className={`py-2 rounded-xl text-sm font-medium border ${cardProvider === "tuu" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-brand-gray border-gray-200 hover:bg-gray-50"}`}
              >
                TUU
              </button>
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-brand-gray mb-1">API Key</label>
            <input
              type="password"
              value={tuuApiKey}
              onChange={(e) => setTuuApiKey(e.target.value)}
              placeholder="Clave de tu comercio"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono"
            />
            <p className="text-[10px] text-brand-gray mt-1">
              Obtenla en tu Espacio de Trabajo (Workspace) TUU, sección Pagos → Configuración → API. Es unica por comercio, no por maquina.
            </p>
          </div>

          <button
            onClick={async () => {
              if (!tenantId) return;
              setTuuSaving(true);
              await fetch("/api/settings/tuu", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenantId, tuu_api_key: tuuApiKey }),
              });
              setTuuSaving(false);
              setTuuConfigured(true);
              showToast("API Key guardada", "success");
            }}
            disabled={tuuSaving || !tuuApiKey}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {tuuSaving ? "Guardando..." : "Guardar API Key"}
          </button>

          {/* Terminals Section */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-brand-dark">Terminales TUU</p>
                <p className="text-[10px] text-brand-gray">Numero de serie (SN) impreso en la etiqueta de la maquina</p>
              </div>
              <button
                onClick={() => setShowAddTuuTerminal(true)}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 font-medium"
              >
                + Anadir terminal
              </button>
            </div>

            {tuuTerminals.length > 0 ? (
              <div className="space-y-2">
                {tuuTerminals.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-dark truncate">{t.name}</p>
                      <p className="text-[10px] font-mono text-brand-gray truncate">{t.device_serial}</p>
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
                        await fetch(`/api/settings/tuu/terminals?id=${t.id}`, { method: "DELETE" });
                        setTuuTerminals((prev) => prev.filter((x) => x.id !== t.id));
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
                <p className="text-[10px] text-brand-gray mt-1">Agrega la maquina para empezar a cobrar con TUU</p>
              </div>
            )}
          </div>

          {showAddTuuTerminal && (
            <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-brand-dark">Nueva terminal TUU</p>
              <div>
                <label className="block text-[10px] text-brand-gray mb-1">Nombre</label>
                <input
                  type="text"
                  value={newTuuTerminal.name}
                  onChange={(e) => setNewTuuTerminal({ ...newTuuTerminal, name: e.target.value })}
                  placeholder="Ej: Maquina Recepcion"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] text-brand-gray mb-1">Numero de serie (SN)</label>
                <input
                  type="text"
                  value={newTuuTerminal.device_serial}
                  onChange={(e) => setNewTuuTerminal({ ...newTuuTerminal, device_serial: e.target.value })}
                  placeholder="Ej: 6010B232571510771"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                />
                <p className="text-[10px] text-brand-gray mt-1">Esta impreso bajo "SN:" en la etiqueta detras de la maquina, junto al codigo QR de ayuda.</p>
              </div>
              <div>
                <label className="block text-[10px] text-brand-gray mb-1">Tipo de cobro</label>
                <select
                  value={newTuuTerminal.terminal_type}
                  onChange={(e) => setNewTuuTerminal({ ...newTuuTerminal, terminal_type: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">Todo (servicios + productos)</option>
                  <option value="services">Solo Servicios (exento IVA)</option>
                  <option value="products">Solo Productos (afecto IVA)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowAddTuuTerminal(false); setNewTuuTerminal({ name: "", device_serial: "", terminal_type: "all" }); }}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-brand-gray hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!tenantId || !newTuuTerminal.name || !newTuuTerminal.device_serial) {
                      showToast("Completa nombre y numero de serie", "error"); return;
                    }
                    const res = await fetch("/api/settings/tuu/terminals", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tenantId, ...newTuuTerminal }),
                    });
                    const data = await res.json();
                    if (data.id) {
                      setTuuTerminals((prev) => [...prev, data]);
                      setShowAddTuuTerminal(false);
                      setNewTuuTerminal({ name: "", device_serial: "", terminal_type: "all" });
                      showToast("Terminal agregado", "success");
                    } else {
                      showToast(data.error || "Error", "error");
                    }
                  }}
                  disabled={!newTuuTerminal.name || !newTuuTerminal.device_serial}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  Agregar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deposit / Abono Config */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
            <div>
              <h2 className="font-bold text-brand-dark">Abono para Reservas</h2>
              <p className="text-xs text-brand-gray">Cobra un anticipo al momento de agendar para reducir cancelaciones</p>
            </div>
          </div>
          <button
            onClick={() => setDepositEnabled(!depositEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${depositEnabled ? "bg-green-500" : "bg-gray-300"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${depositEnabled ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>

        {depositEnabled && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-brand-gray mb-1">Porcentaje de abono</label>
                <select value={depositPercentage} onChange={(e) => setDepositPercentage(parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                  <option value={20}>20%</option>
                  <option value={30}>30%</option>
                  <option value={40}>40%</option>
                  <option value={50}>50%</option>
                  <option value={75}>75%</option>
                  <option value={100}>100% (pago completo)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-gray mb-1">Cancelacion gratis hasta</label>
                <select value={cancellationHours} onChange={(e) => setCancellationHours(parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                  <option value={2}>2 horas antes</option>
                  <option value={6}>6 horas antes</option>
                  <option value={12}>12 horas antes</option>
                  <option value={24}>24 horas antes</option>
                  <option value={48}>48 horas antes</option>
                  <option value={72}>72 horas antes</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-gray mb-1">Mensaje al cliente</label>
              <input type="text" value={depositMessage} onChange={(e) => setDepositMessage(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                placeholder="Este servicio requiere un abono para confirmar tu cita." />
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-xs text-green-700">
                <strong>Ejemplo:</strong> Si un servicio cuesta $35.000 y el abono es 30%, la clienta paga $10.500 al agendar.
                Si cancela antes de {cancellationHours}h, se le devuelve. Despues de ese plazo, pierde el abono.
              </p>
            </div>

            <button
              onClick={async () => {
                if (!tenantId) return;
                setDepositSaving(true);
                await fetch("/api/settings/deposit", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    tenantId,
                    deposit_enabled: depositEnabled,
                    deposit_percentage: depositPercentage,
                    cancellation_free_hours: cancellationHours,
                    deposit_message: depositMessage,
                  }),
                });
                setDepositSaving(false);
                showToast("Configuracion de abono guardada", "success");
              }}
              disabled={depositSaving}
              className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {depositSaving ? "Guardando..." : "Guardar Abono"}
            </button>
          </div>
        )}
      </div>

      {/* Privacidad: cambiar contraseña */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-brand-gray" />
          <div>
            <h2 className="font-bold text-brand-dark">Privacidad</h2>
            <p className="text-xs text-brand-gray">Cambia tu contraseña sin depender de un administrador</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-brand-gray mb-1">Contraseña actual</label>
            <input type="password" value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-gray mb-1">Nueva contraseña</label>
            <input type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-gray mb-1">Confirmar nueva contraseña</label>
            <input type="password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
          </div>
        </div>

        {passwordError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{passwordError}</p>}

        <button onClick={handleChangePassword} disabled={changingPassword}
          className="px-6 py-2.5 bg-brand-dark text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors">
          {changingPassword ? "Cambiando..." : "Cambiar contraseña"}
        </button>
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
