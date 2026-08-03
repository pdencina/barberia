"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PortalLoginPage() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [identifier, setIdentifier] = useState("");
  const [identifierType, setIdentifierType] = useState<"email" | "phone">("email");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body = identifierType === "email"
      ? { email: identifier }
      : { phone: identifier };

    const res = await fetch("/api/portal/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);
    if (res.ok) {
      setStep("code");
    } else {
      setError("Error al enviar codigo. Intenta de nuevo.");
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body = identifierType === "email"
      ? { email: identifier, code }
      : { phone: identifier, code };

    const res = await fetch("/api/portal/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok && data.clientId) {
      // Store session in localStorage
      localStorage.setItem("portal_client_id", data.clientId);
      localStorage.setItem("portal_client_name", data.clientName);
      localStorage.setItem("portal_token", data.token);
      router.push("/portal/dashboard");
    } else {
      setError(data.error || "Codigo incorrecto");
    }
  };

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo-horizontal.png" alt="re-booking" className="h-12 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-brand-dark">Portal del Cliente</h1>
          <p className="text-sm text-brand-gray mt-1">Consulta tus citas y beneficios</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl shadow-blue-900/5 p-6">
          {step === "email" && (
            <form onSubmit={requestCode} className="space-y-4">
              {/* Toggle email/phone */}
              <div className="flex bg-brand-light rounded-xl p-1 gap-1">
                <button type="button"
                  onClick={() => { setIdentifierType("email"); setIdentifier(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${identifierType === "email" ? "bg-white text-brand-dark shadow-sm" : "text-brand-gray"}`}>
                  Email
                </button>
                <button type="button"
                  onClick={() => { setIdentifierType("phone"); setIdentifier(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${identifierType === "phone" ? "bg-white text-brand-dark shadow-sm" : "text-brand-gray"}`}>
                  Telefono
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-brand-gray block mb-1.5">
                  {identifierType === "email" ? "Tu email" : "Tu telefono"}
                </label>
                <input
                  type={identifierType === "email" ? "email" : "tel"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={identifierType === "email" ? "tu@email.com" : "+56 9 1234 5678"}
                  required
                  className="w-full h-11 rounded-xl border border-gray-200 bg-brand-light/50 px-4 text-sm text-brand-dark placeholder:text-brand-gray focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent focus:bg-white transition-all"
                />
              </div>

              {error && <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg py-2">{error}</p>}

              <button type="submit" disabled={loading || !identifier.trim()}
                className="w-full h-11 rounded-xl bg-brand-blue text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                {loading ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg> Enviando...</>
                ) : "Enviar codigo de acceso"}
              </button>

              <p className="text-center text-[11px] text-brand-gray">
                Te enviaremos un codigo de 4 digitos para verificar tu identidad
              </p>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={verifyCode} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-12 h-12 bg-brand-blue/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <p className="text-sm text-brand-dark font-medium">Codigo enviado a</p>
                <p className="text-xs text-brand-gray">{identifier}</p>
              </div>

              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="0000"
                  autoFocus
                  className="w-full h-14 rounded-xl border border-gray-200 bg-brand-light/50 px-4 text-center text-3xl font-bold tracking-[0.4em] text-brand-dark placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent focus:bg-white transition-all"
                />
              </div>

              {error && <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg py-2">{error}</p>}

              <button type="submit" disabled={loading || code.length !== 4}
                className="w-full h-11 rounded-xl bg-brand-blue text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                {loading ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg> Verificando...</>
                ) : "Verificar"}
              </button>

              <button type="button" onClick={() => { setStep("email"); setCode(""); setError(""); }}
                className="w-full text-xs text-brand-gray hover:text-brand-blue transition-colors text-center">
                ← Usar otro email o telefono
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <a href="/booking" className="text-xs text-brand-gray hover:text-brand-blue transition-colors">
            Agendar una cita →
          </a>
        </div>
      </div>
    </div>
  );
}
