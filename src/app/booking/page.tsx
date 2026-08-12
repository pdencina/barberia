"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
}

interface Barber {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  specialties: string[] | null;
  intro_video_url: string | null;
  years_experience: number | null;
}

type Step = "barber" | "service" | "datetime" | "details" | "confirmed";

export default function BookingPage() {
  const [step, setStep] = useState<Step>("barber");
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Selections
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [clientFound, setClientFound] = useState(false);
  const [appointmentId, setAppointmentId] = useState("");
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  // Computed totals
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

  const [closedDays, setClosedDays] = useState<number[]>([]);

  useEffect(() => {
    // Get tenant slug from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const tenantSlug = urlParams.get("tenant") || urlParams.get("branch");
    const barberSlug = urlParams.get("barber");
    const barberUrl = tenantSlug ? `/api/public/barbers?branch=${tenantSlug}` : "/api/public/barbers";

    fetch(barberUrl).then((r) => r.json()).then((data) => {
      setBarbers(data);
      // Auto-select barber if URL has ?barber=slug
      if (barberSlug && data.length > 0) {
        const match = data.find((b: any) => b.name.toLowerCase().replace(/\s+/g, "-") === barberSlug);
        if (match) {
          setSelectedBarber(match);
          setStep("service");
        }
      }
    });
    fetch("/api/business-hours").then((r) => r.json()).then((hours: any[]) => {
      setClosedDays(hours.filter((h) => h.is_closed).map((h) => h.day_of_week));
    });
  }, []);

  // Load services when barber is selected (with custom prices)
  useEffect(() => {
    if (selectedBarber) {
      fetch(`/api/public/barber-services?barberId=${selectedBarber.id}`)
        .then((r) => r.json())
        .then((data) => setServices(Array.isArray(data) ? data : []));
    }
  }, [selectedBarber]);

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  // Fetch slots when barber or date changes
  useEffect(() => {
    if (selectedBarber && selectedDate && selectedServices.length > 0) {
      setLoadingSlots(true);
      setSelectedSlot("");
      fetch(
        `/api/public/availability?barberId=${selectedBarber.id}&date=${selectedDate}&duration=${totalDuration}`
      )
        .then((r) => r.json())
        .then((data) => setSlots(data.slots || []))
        .finally(() => setLoadingSlots(false));
    }
  }, [selectedBarber, selectedDate, selectedServices]);

  const handleBook = async () => {
    setError("");
    setSubmitting(true);

    const res = await fetch("/api/public/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceIds: selectedServices.map((s) => s.id),
        barberId: selectedBarber!.id,
        date: selectedDate,
        startTime: selectedSlot,
        clientName,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        notes: notes || null,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (res.ok) {
      setAppointmentId(data.appointmentId || "");
      setStep("confirmed");
    } else {
      setError(data.error || "Error al agendar. Intenta de nuevo.");
    }
  };

  // Generate date options (next 14 days, excluding past)
  const dateOptions: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    // Skip closed days
    if (closedDays.includes(d.getDay())) continue;
    dateOptions.push(d.toISOString().split("T")[0]);
  }

  return (
    <div className="min-h-screen bg-brand-light text-brand-dark">
      {/* Header */}
      <div className="border-b border-gray-100 py-4 px-6 flex items-center justify-between bg-white">
        <div className="flex-1" />
        <div className="text-center">
          <img src="/logo-horizontal.png" alt="re-booking" className="h-10 mx-auto" />
          <p className="text-xs text-brand-blue uppercase tracking-widest mt-2 font-medium">Agendar Hora</p>
        </div>
        <div className="flex-1 flex justify-end">
          <button onClick={async () => {
            const { createClient } = await import("@/lib/supabase/client");
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = "/login";
          }} className="text-xs text-brand-gray hover:text-brand-dark transition-colors px-2 py-1 rounded">
            Salir
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Progress indicator */}
        {step !== "confirmed" && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {["barber", "service", "datetime", "details"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s ? "bg-brand-blue text-white" :
                  ["barber", "service", "datetime", "details"].indexOf(step) > i
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-brand-gray"
                }`}>
                  {i + 1}
                </div>
                {i < 3 && <div className="w-8 h-0.5 bg-gray-200" />}
              </div>
            ))}
          </div>
        )}

        {/* Step 2: Service (después de elegir barbero) */}
        {step === "service" && (
          <div>
            <button onClick={() => setStep("barber")} className="text-brand-gray hover:text-brand-blue text-sm mb-4 flex items-center gap-1">
              ← Volver
            </button>
            <h2 className="text-2xl font-bold mb-2">Servicios de {selectedBarber?.name}</h2>
            <p className="text-brand-gray mb-6">Selecciona uno o mas servicios</p>
            <div className="space-y-3">
              {services.map((s) => {
                const isSelected = selectedServices.some((ss) => ss.id === s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedServices(selectedServices.filter((ss) => ss.id !== s.id));
                      } else {
                        setSelectedServices([...selectedServices, s]);
                      }
                    }}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors text-left ${
                      isSelected
                        ? "border-brand-blue bg-brand-blue/10"
                        : "border-gray-200 hover:border-brand-blue hover:bg-blue-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected ? "border-brand-blue bg-brand-blue" : "border-gray-300"
                      }`}>
                        {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <div>
                        <p className="font-medium text-brand-dark">{s.name}</p>
                        <p className="text-sm text-brand-gray">{s.duration} min{s.description ? ` · ${s.description}` : ""}</p>
                      </div>
                    </div>
                    <p className="text-brand-blue font-bold text-lg">{formatCurrency(Number(s.price))}</p>
                  </button>
                );
              })}
            </div>

            {/* Selection summary */}
            {selectedServices.length > 0 && (
              <div className="mt-6 p-4 bg-white border border-gray-200 rounded-xl">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-brand-gray">{selectedServices.length} servicio{selectedServices.length > 1 ? "s" : ""}</span>
                  <span className="text-brand-gray">{totalDuration} min total</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-brand-dark font-medium">Total</span>
                  <span className="text-brand-blue font-bold text-xl">{formatCurrency(totalPrice)}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setStep("datetime")}
              disabled={selectedServices.length === 0}
              className="w-full mt-4 py-3 rounded-xl bg-brand-blue text-white font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Step 1: Barber (PRIMERO) */}
        {step === "barber" && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Elige tu barbero</h2>
            <p className="text-brand-gray mb-6">Selecciona un miembro del equipo</p>

            {/* First available button */}
            <button
              onClick={async () => {
                const res = await fetch(`/api/public/first-available?date=${selectedDate || new Date().toISOString().split("T")[0]}`);
                const data = await res.json();
                if (data.barber) {
                  setSelectedBarber(data.barber);
                  setSelectedServices([]);
                  setStep("service");
                }
              }}
              className="w-full mb-4 p-4 rounded-xl border-2 border-brand-blue bg-brand-blue/10 hover:bg-brand-blue/20 transition-colors text-center"
            >
              <p className="font-bold text-brand-blue text-lg">Primer barbero disponible</p>
              <p className="text-xs text-brand-gray">Te asignamos al barbero con mas disponibilidad</p>
            </button>

            <p className="text-center text-xs text-brand-gray mb-4">o elige directamente:</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {barbers.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { setSelectedBarber(b); setSelectedServices([]); setStep("service"); }}
                  className="flex flex-col items-center p-5 rounded-2xl border border-gray-200 hover:border-brand-blue hover:shadow-lg transition-all text-center group"
                >
                  {b.avatar_url ? (
                    <img src={b.avatar_url} alt={b.name} className="w-20 h-20 rounded-full object-cover border-2 border-gray-100 group-hover:border-brand-blue/50 transition-colors" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-brand-gray group-hover:bg-brand-blue/10 group-hover:text-brand-blue transition-colors">
                      {b.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                  )}
                  <p className="font-semibold text-brand-dark text-sm mt-3">{b.name}</p>
                  {b.specialties && b.specialties.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 mt-2">
                      {b.specialties.slice(0, 3).map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-brand-blue/10 text-brand-blue text-[10px] rounded-full">{s}</span>
                      ))}
                    </div>
                  )}
                  {b.bio && <p className="text-xs text-brand-gray mt-2 line-clamp-2">{b.bio}</p>}
                  {b.years_experience && (
                    <p className="text-[10px] text-brand-gray mt-1">{b.years_experience} años de experiencia</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === "datetime" && (
          <div>
            <button onClick={() => setStep("service")} className="text-brand-gray hover:text-brand-blue text-sm mb-4 flex items-center gap-1">
              ← Volver
            </button>
            <h2 className="text-2xl font-bold mb-2">Selecciona fecha y hora</h2>
            <p className="text-brand-gray mb-6">{selectedServices.map((s) => s.name).join(" + ")} con {selectedBarber?.name}</p>

            {/* Date selection */}
            <div className="mb-6">
              <label className="text-sm text-brand-gray mb-2 block">Fecha</label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dateOptions.map((d) => {
                  const dateObj = new Date(d + "T12:00:00");
                  const dayName = dateObj.toLocaleDateString("es-CL", { weekday: "short" });
                  const dayNum = dateObj.getDate();
                  const monthName = dateObj.toLocaleDateString("es-CL", { month: "short" });
                  return (
                    <button
                      key={d}
                      onClick={() => setSelectedDate(d)}
                      className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border transition-colors ${
                        selectedDate === d
                          ? "border-brand-blue bg-brand-blue/10 text-brand-dark"
                          : "border-gray-200 text-brand-gray hover:border-brand-blue/50"
                      }`}
                    >
                      <span className="text-xs uppercase">{dayName}</span>
                      <span className="text-lg font-bold">{dayNum}</span>
                      <span className="text-xs">{monthName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time slots */}
            <div>
              <label className="text-sm text-brand-gray mb-2 block">Hora disponible</label>
              {loadingSlots ? (
                <div className="text-center py-8 text-brand-gray">Buscando horarios...</div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-brand-gray mb-4">No hay horarios disponibles para esta fecha</p>
                  {!showWaitlist && !waitlistSubmitted && (
                    <button
                      onClick={() => setShowWaitlist(true)}
                      className="px-4 py-2 border border-brand-blue text-brand-blue rounded-xl hover:bg-brand-blue/10 text-sm"
                    >
                      Avisame cuando haya hora
                    </button>
                  )}
                  {showWaitlist && (
                    <div className="mt-4 p-4 bg-white border border-gray-200 rounded-xl text-left space-y-3">
                      <p className="text-sm text-brand-dark font-medium">Te avisamos cuando se libere una hora:</p>
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Tu nombre"
                        className="w-full rounded-xl border border-gray-200 bg-brand-light/50 px-3 py-2 text-sm text-brand-dark placeholder:text-brand-gray focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none"
                      />
                      <input
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="Email"
                        className="w-full rounded-xl border border-gray-200 bg-brand-light/50 px-3 py-2 text-sm text-brand-dark placeholder:text-brand-gray focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none"
                      />
                      <input
                        type="tel"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="Telefono (WhatsApp)"
                        className="w-full rounded-xl border border-gray-200 bg-brand-light/50 px-3 py-2 text-sm text-brand-dark placeholder:text-brand-gray focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none"
                      />
                      <button
                        onClick={async () => {
                          if (!clientName) return;
                          await fetch("/api/public/waitlist", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              clientName,
                              clientEmail,
                              clientPhone,
                              serviceId: selectedServices[0]?.id || null,
                              barberId: selectedBarber?.id || null,
                              preferredDate: selectedDate,
                            }),
                          });
                          setShowWaitlist(false);
                          setWaitlistSubmitted(true);
                        }}
                        disabled={!clientName}
                        className="w-full py-2 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        Anotarme en lista de espera
                      </button>
                    </div>
                  )}
                  {waitlistSubmitted && (
                    <p className="text-green-400 text-sm mt-2">Listo! Te avisaremos cuando haya hora disponible.</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {slots.map((slot) => {
                    const time = new Date(slot).toLocaleTimeString("es-CL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-3 rounded-xl border text-sm font-medium transition-colors ${
                          selectedSlot === slot
                            ? "border-brand-blue bg-brand-blue text-white"
                            : "border-gray-200 text-brand-dark hover:border-brand-blue hover:text-brand-blue"
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => setStep("details")}
              disabled={!selectedSlot}
              className="w-full mt-6 py-3 rounded-xl bg-brand-blue text-white font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Step 4: Client details */}
        {step === "details" && (
          <div>
            <button onClick={() => setStep("datetime")} className="text-brand-gray hover:text-brand-blue text-sm mb-4 flex items-center gap-1">
              ← Volver
            </button>
            <h2 className="text-2xl font-bold mb-2">Tus datos</h2>
            <p className="text-brand-gray mb-6">Ingresa tu informacion para confirmar la cita</p>

            {/* Summary card */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-brand-gray">Servicios</span>
                <span className="text-white font-medium">{selectedServices.map((s) => s.name).join(" + ")}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-brand-gray">Barbero</span>
                <span className="text-white">{selectedBarber?.name}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-brand-gray">Fecha</span>
                <span className="text-white">{new Date(selectedDate + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-brand-gray">Hora</span>
                <span className="text-white font-bold">{new Date(selectedSlot).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-brand-gray">Duracion</span>
                <span className="text-brand-dark">{totalDuration} min</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                <span className="text-brand-gray">Total</span>
                <span className="text-brand-blue font-bold">{formatCurrency(totalPrice)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-brand-gray mb-1 block">Email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => { setClientEmail(e.target.value); setClientFound(false); }}
                  onBlur={async () => {
                    if (clientEmail && clientEmail.includes("@")) {
                      const res = await fetch(`/api/public/client-lookup?email=${encodeURIComponent(clientEmail)}`);
                      const data = await res.json();
                      if (data.found) {
                        setClientName(data.client.name);
                        setClientPhone(data.client.phone || "");
                        setClientFound(true);
                      }
                    }
                  }}
                  placeholder="tu@email.com (para confirmacion)"
                  className="w-full rounded-xl border border-gray-200 bg-brand-light/50 px-4 py-3 text-brand-dark placeholder:text-brand-gray focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none"
                />
                {clientFound && (
                  <p className="text-xs text-green-400 mt-1">Bienvenido de vuelta! Datos prellenados.</p>
                )}
              </div>
              <div>
                <label className="text-sm text-brand-gray mb-1 block">Nombre *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Tu nombre completo"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-brand-light/50 px-4 py-3 text-brand-dark placeholder:text-brand-gray focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-brand-gray mb-1 block">Celular (WhatsApp) *</label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+56 9 XXXX XXXX"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-brand-light/50 px-4 py-3 text-brand-dark placeholder:text-brand-gray focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-brand-gray mb-1 block">Direccion (opcional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Calle, numero, comuna"
                  className="w-full rounded-xl border border-gray-200 bg-brand-light/50 px-4 py-3 text-brand-dark placeholder:text-brand-gray focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none"
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mt-3 text-center bg-red-50 rounded-lg py-2">{error}</p>}

            <button
              onClick={handleBook}
              disabled={!clientName.trim() || !clientPhone.trim() || submitting}
              className="w-full mt-6 py-4 rounded-xl bg-brand-blue text-white font-bold text-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Agendando..." : "Confirmar Cita"}
            </button>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === "confirmed" && (
          <div className="text-center py-12">
            <img src="/oti/confirmado.png" alt="Confirmado!" className="w-24 h-24 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-3">Cita Confirmada!</h2>
            <p className="text-brand-gray mb-6">Tu cita ha sido agendada exitosamente</p>

            <div className="bg-white border border-gray-200 rounded-xl p-6 text-left max-w-sm mx-auto mb-8">
              <p className="text-sm text-brand-gray mb-1">Servicios</p>
              <p className="text-brand-dark font-medium mb-3">{selectedServices.map((s) => s.name).join(" + ")}</p>
              <p className="text-sm text-brand-gray mb-1">Barbero</p>
              <p className="text-white mb-3">{selectedBarber?.name}</p>
              <p className="text-sm text-brand-gray mb-1">Fecha y hora</p>
              <p className="text-white font-bold">
                {new Date(selectedSlot).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
                {" - "}
                {new Date(selectedSlot).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>

            {clientEmail && (
              <p className="text-sm text-gray-500 mb-6">
                Te enviamos un email de confirmacion a <strong className="text-gray-300">{clientEmail}</strong>
              </p>
            )}

            {/* Payment option */}
            {totalPrice > 0 && appointmentId && (
              <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl">
                <p className="text-sm text-brand-gray mb-3">Quieres pagar ahora?</p>
                <button
                  onClick={async () => {
                    const res = await fetch("/api/payments/create-preference", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        appointmentId,
                        services: selectedServices.map((s) => ({ name: s.name, price: Number(s.price) })),
                        clientName,
                        clientEmail,
                        totalPrice,
                      }),
                    });
                    const data = await res.json();
                    if (data.initPoint) {
                      window.location.href = data.initPoint;
                    }
                  }}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors mb-2"
                >
                  Pagar {formatCurrency(totalPrice)} con MercadoPago
                </button>
                <p className="text-xs text-gray-500 text-center">O puedes pagar directamente en el local</p>
              </div>
            )}

            <button
              onClick={() => {
                setStep("barber");
                setSelectedServices([]);
                setSelectedBarber(null);
                setSelectedSlot("");
                setClientName("");
                setClientEmail("");
                setClientPhone("");
                setNotes("");
                setClientFound(false);
                setShowWaitlist(false);
                setWaitlistSubmitted(false);
              }}
              className="px-6 py-3 rounded-xl border border-gray-200 text-brand-gray hover:border-brand-blue hover:text-brand-blue transition-colors"
            >
              Agendar otra cita
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 py-4 text-center text-xs text-brand-gray">
        re-booking · rebooking.cl
      </div>
    </div>
  );
}
