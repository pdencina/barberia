"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Whether we detected a usable recovery link. null = still checking.
  const [linkValid, setLinkValid] = useState<boolean | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resendSent, setResendSent] = useState(false);
  const [resending, setResending] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Supabase redirects here with either:
    //  - #access_token=...&type=recovery  → link is valid, session gets set automatically
    //  - #error=access_denied&error_code=otp_expired&... → link expired or already used
    // The previous version ignored the error case entirely: it let the user fill out
    // the whole form and only failed at the very end with a generic message, which was
    // confusing. Now we detect it immediately and explain clearly what happened.
    const hash = window.location.hash;
    if (hash.includes("error=")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const code = params.get("error_code");
      if (code === "otp_expired") {
        setError("Este link ya expiro o ya fue usado. Pide uno nuevo abajo.");
      } else {
        setError(params.get("error_description")?.replace(/\+/g, " ") || "Este link no es valido. Pide uno nuevo abajo.");
      }
      setLinkValid(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setLinkValid(true);
      }
    });

    // If Supabase already had time to process the hash before this component mounted,
    // there may already be a session — check directly instead of waiting forever.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setLinkValid(true);
    });

    // Give the SDK a few seconds to process the URL hash; if nothing happened by then,
    // treat the link as unusable instead of leaving the user staring at a blank state.
    const timeout = setTimeout(() => {
      setLinkValid((current) => {
        if (current === null) {
          setError("No pudimos validar tu link de recuperacion. Pide uno nuevo abajo.");
          return false;
        }
        return current;
      });
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("Error al actualizar contraseña. El link puede haber expirado. Pide uno nuevo abajo.");
      setLinkValid(false);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResending(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resendEmail }),
    });
    setResendSent(true);
    setResending(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-light p-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-xl p-8 text-center">
          <img src="/oti/oti-web-160.png" alt="Oti" className="w-20 h-20 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-brand-dark">contraseña actualizada</h2>
          <p className="text-sm text-brand-gray mt-2">Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  // Link expired, already used, or invalid: offer to send a new one right here
  // instead of a dead-end error (this was the exact case Nico ran into).
  if (linkValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-light p-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-xl shadow-blue-900/5 p-6 md:p-8">
          <div className="text-center mb-6">
            <img src="/logo-horizontal.png" alt="re-booking" className="h-10 w-auto mx-auto mb-3" />
            <h2 className="text-lg font-bold text-brand-dark">Link no valido</h2>
            <p className="text-xs text-brand-gray mt-1">{error || "Este link ya expiro o ya fue usado."}</p>
          </div>

          {resendSent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">📧</div>
              <p className="text-sm text-brand-gray">Si la cuenta existe, te llegara un link nuevo. Puede tardar un minuto.</p>
              <a href="/login" className="inline-block mt-4 text-xs text-brand-blue hover:underline">Volver al login</a>
            </div>
          ) : (
            <form onSubmit={handleResend} className="space-y-3">
              <label className="text-xs font-medium text-brand-gray">Tu email</label>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoFocus
                className="w-full h-11 rounded-xl border border-gray-200 bg-brand-light/50 px-4 text-sm text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
              <button type="submit" disabled={resending}
                className="w-full h-11 rounded-xl bg-brand-blue text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-70">
                {resending ? "Enviando..." : "Enviar link nuevo"}
              </button>
              <div className="text-center">
                <a href="/login" className="text-xs text-brand-gray hover:text-brand-blue">Volver al login</a>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-xl shadow-blue-900/5 p-6 md:p-8">
        <div className="text-center mb-6">
          <img src="/logo-horizontal.png" alt="re-booking" className="h-10 w-auto mx-auto mb-3" />
          <h2 className="text-lg font-bold text-brand-dark">Nueva contraseña</h2>
          <p className="text-xs text-brand-gray mt-1">Ingresa tu nueva contraseña</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-brand-gray">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-brand-light/50 px-4 pr-10 py-2 text-sm text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent focus:bg-white transition-all"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-brand-dark">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-brand-gray">Confirmar contraseña</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="flex h-11 w-full rounded-xl border border-gray-200 bg-brand-light/50 px-4 py-2 text-sm text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent focus:bg-white transition-all"
            />
          </div>

          {error && <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg py-2">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full h-11 rounded-xl bg-brand-blue text-white text-sm font-bold uppercase tracking-wider hover:bg-blue-700 disabled:opacity-70 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Actualizando...
              </>
            ) : "Actualizar contraseña"}
          </button>

          <div className="text-center">
            <a href="/login" className="text-xs text-brand-gray hover:text-brand-blue transition-colors">
              â† Volver al login
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
