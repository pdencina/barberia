"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

interface TeamMember {
  name: string;
  email: string;
  phone: string;
}

interface ServiceItem {
  name: string;
  price: string;
  duration: string;
}

const dayNames = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  // Step 1: Team
  const [members, setMembers] = useState<TeamMember[]>([{ name: "", email: "", phone: "" }]);

  // Step 2: Services
  const [services, setServices] = useState<ServiceItem[]>([
    { name: "Corte de cabello", price: "15000", duration: "30" },
    { name: "Barba", price: "8000", duration: "20" },
  ]);

  // Step 3: Hours
  const [hours, setHours] = useState(
    dayNames.map((_, i) => ({ day: i + 1, open: "10:00", close: "21:00", closed: i === 6 }))
  );

  const addMember = () => setMembers([...members, { name: "", email: "", phone: "" }]);
  const removeMember = (i: number) => setMembers(members.filter((_, idx) => idx !== i));
  const updateMember = (i: number, field: string, value: string) => {
    const updated = [...members];
    (updated[i] as any)[field] = value;
    setMembers(updated);
  };

  const addService = () => setServices([...services, { name: "", price: "", duration: "45" }]);
  const removeService = (i: number) => setServices(services.filter((_, idx) => idx !== i));
  const updateService = (i: number, field: string, value: string) => {
    const updated = [...services];
    (updated[i] as any)[field] = value;
    setServices(updated);
  };

  const handleFinish = async () => {
    setSaving(true);

    // Save team members
    const validMembers = members.filter((m) => m.name.trim());
    if (validMembers.length > 0) {
      for (const member of validMembers) {
        await fetch("/api/barberos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: member.name, email: member.email || `${member.name.toLowerCase().replace(/\s/g, "")}@temp.cl`, phone: member.phone, password: "123456" }),
        });
      }
    }

    // Save services
    const validServices = services.filter((s) => s.name.trim() && s.price);
    if (validServices.length > 0) {
      for (const svc of validServices) {
        await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: svc.name, price: parseInt(svc.price), duration: parseInt(svc.duration) || 45, active: true }),
        });
      }
    }

    // Save business hours
    for (const h of hours) {
      await fetch("/api/business-hours", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: h.day === 7 ? 0 : h.day, openTime: h.open, closeTime: h.close, isClosed: h.closed }),
      });
    }

    // Mark onboarding complete
    await fetch("/api/auth/complete-onboarding", { method: "POST" });

    setSaving(false);
    showToast("Configuracion completa! Bienvenido a re-booking", "success");
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo-horizontal.png" alt="re-booking" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-brand-dark">Configura tu negocio</h1>
          <p className="text-sm text-brand-gray mt-1">3 pasos rapidos para empezar a operar</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === s ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/30" :
                step > s ? "bg-brand-accent text-white" :
                "bg-gray-200 text-brand-gray"
              }`}>
                {step > s ? "✓" : s}
              </div>
              {s < 3 && <div className={`w-12 h-1 rounded-full ${step > s ? "bg-brand-accent" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8">

          {/* Step 1: Team */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <img src="/oti/feliz.png" alt="Oti" className="w-12 h-12" />
                <div>
                  <h2 className="text-lg font-bold text-brand-dark">Agrega tu equipo</h2>
                  <p className="text-sm text-brand-gray">Quienes trabajan en tu negocio?</p>
                </div>
              </div>

              <div className="space-y-3">
                {members.map((m, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <input type="text" value={m.name} onChange={(e) => updateMember(i, "name", e.target.value)}
                        placeholder="Nombre *" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
                      <input type="email" value={m.email} onChange={(e) => updateMember(i, "email", e.target.value)}
                        placeholder="Email" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
                      <input type="tel" value={m.phone} onChange={(e) => updateMember(i, "phone", e.target.value)}
                        placeholder="Telefono" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
                    </div>
                    {members.length > 1 && (
                      <button onClick={() => removeMember(i)} className="text-red-400 hover:text-red-600 p-2 mt-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addMember} className="mt-3 text-sm text-brand-blue hover:underline font-medium">
                + Agregar profesional
              </button>
            </div>
          )}

          {/* Step 2: Services */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <img src="/oti/gestionando.png" alt="Oti" className="w-12 h-12" />
                <div>
                  <h2 className="text-lg font-bold text-brand-dark">Configura tus servicios</h2>
                  <p className="text-sm text-brand-gray">Que ofreces a tus clientes?</p>
                </div>
              </div>

              <div className="space-y-3">
                {services.map((s, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <input type="text" value={s.name} onChange={(e) => updateService(i, "name", e.target.value)}
                        placeholder="Servicio *" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
                      <input type="number" value={s.price} onChange={(e) => updateService(i, "price", e.target.value)}
                        placeholder="Precio ($)" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
                      <input type="number" value={s.duration} onChange={(e) => updateService(i, "duration", e.target.value)}
                        placeholder="Min" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
                    </div>
                    {services.length > 1 && (
                      <button onClick={() => removeService(i)} className="text-red-400 hover:text-red-600 p-2 mt-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addService} className="mt-3 text-sm text-brand-blue hover:underline font-medium">
                + Agregar servicio
              </button>
            </div>
          )}

          {/* Step 3: Hours */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <img src="/oti/confirmado.png" alt="Oti" className="w-12 h-12" />
                <div>
                  <h2 className="text-lg font-bold text-brand-dark">Horarios de atencion</h2>
                  <p className="text-sm text-brand-gray">Cuando atiendes clientes?</p>
                </div>
              </div>

              <div className="space-y-2">
                {hours.map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <input type="checkbox" checked={!h.closed}
                      onChange={(e) => { const u = [...hours]; u[i].closed = !e.target.checked; setHours(u); }}
                      className="w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
                    <span className={`w-24 text-sm font-medium ${h.closed ? "text-brand-gray line-through" : "text-brand-dark"}`}>
                      {dayNames[i]}
                    </span>
                    {!h.closed && (
                      <>
                        <input type="time" value={h.open}
                          onChange={(e) => { const u = [...hours]; u[i].open = e.target.value; setHours(u); }}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                        <span className="text-brand-gray text-sm">a</span>
                        <input type="time" value={h.close}
                          onChange={(e) => { const u = [...hours]; u[i].close = e.target.value; setHours(u); }}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                      </>
                    )}
                    {h.closed && <span className="text-xs text-brand-gray italic">Cerrado</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
            {step > 1 && (
              <button onClick={() => setStep(step - 1)}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-brand-gray hover:bg-gray-50">
                Atras
              </button>
            )}
            {step < 3 ? (
              <button onClick={() => setStep(step + 1)}
                className="flex-1 py-3 bg-brand-blue text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
                Siguiente
              </button>
            ) : (
              <button onClick={handleFinish} disabled={saving}
                className="flex-1 py-3 bg-brand-blue text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Configurando...</>
                ) : "Finalizar configuracion"}
              </button>
            )}
          </div>

          {/* Skip */}
          <button onClick={() => router.push("/dashboard")}
            className="w-full mt-3 text-xs text-brand-gray hover:text-brand-blue text-center">
            Saltar por ahora →
          </button>
        </div>
      </div>
    </div>
  );
}
