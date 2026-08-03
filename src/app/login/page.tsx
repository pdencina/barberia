"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [changeError, setChangeError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail }),
    });
    setForgotSent(true);
    setForgotLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError("");
    if (newPassword.length < 6) { setChangeError("Minimo 6 caracteres"); return; }
    if (newPassword !== confirmNewPassword) { setChangeError("Las contrasenas no coinciden"); return; }
    setChangingPassword(true);

    // Update password in Supabase Auth
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setChangeError("Error al cambiar contrasena"); setChangingPassword(false); return; }

    // Clear must_change_password flag on tenant
    await fetch("/api/auth/clear-temp-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setChangingPassword(false);
    setShowChangePassword(false);
    router.push("/dashboard");
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Clear any existing session first
    await supabase.auth.signOut();

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Credenciales incorrectas");
      setLoading(false);
    } else {
      // Check if user must change password (new tenant admin)
      const res = await fetch(`/api/auth/check-tenant?email=${encodeURIComponent(email)}`);
      const tenantData = await res.json();

      if (tenantData.must_change_password) {
        setLoading(false);
        setShowChangePassword(true);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light p-4 relative overflow-hidden">
      {/* Background watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg className="w-[600px] h-[600px] text-brand-blue/[0.03]" viewBox="0 0 32 32" fill="currentColor">
          <path d="M16 4a12 12 0 0 1 12 12h-4a8 8 0 0 0-8-8V4z"/>
          <path d="M28 16a12 12 0 0 1-12 12v-4a8 8 0 0 0 8-8h4z" opacity="0.7"/>
          <path d="M16 28A12 12 0 0 1 4 16h4a8 8 0 0 0 8 8v4z" opacity="0.4"/>
        </svg>
      </div>

      {/* Subtle gradient orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-blue/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-brand-blue/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-xl shadow-blue-900/5 p-6 md:p-8 animate-scale-in">
        <div className="text-center mb-8">
          <img src="/oti/complice.png" alt="Oti" className="w-16 h-16 mx-auto mb-3" />
          <img src="/logo.png" alt="re-booking" className="h-10 w-auto mx-auto mb-2" />
          <p className="text-xs text-brand-gray uppercase tracking-[0.2em]">Todo tu negocio. Un solo sistema.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-brand-gray">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex h-11 w-full rounded-xl border border-gray-200 bg-brand-light/50 px-4 py-2 text-sm text-brand-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent focus:bg-white transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-brand-gray">
              Contrasena
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-brand-light/50 px-4 pr-10 py-2 text-sm text-brand-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-brand-dark transition-colors"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-brand-blue text-white text-sm font-bold uppercase tracking-wider hover:bg-blue-700 disabled:opacity-70 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Ingresando...
              </>
            ) : "Ingresar"}
          </button>

          {/* Forgot password */}
          <div className="text-center pt-1">
            <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); }}
              className="text-xs text-brand-gray hover:text-brand-blue transition-colors">
              Olvidaste tu contrasena?
            </button>
          </div>
        </form>
      </div>

      {/* Forgot password modal */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForgot(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {forgotSent ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">📧</div>
                <h3 className="font-bold text-brand-dark">Revisa tu email</h3>
                <p className="text-sm text-brand-gray mt-2">Si la cuenta existe, recibiras un link para restablecer tu contrasena.</p>
                <button onClick={() => { setShowForgot(false); setForgotSent(false); }}
                  className="mt-4 px-6 py-2 bg-brand-blue text-white rounded-xl text-sm font-medium">
                  Entendido
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot}>
                <h3 className="font-bold text-brand-dark text-lg">Recuperar contrasena</h3>
                <p className="text-sm text-brand-gray mt-1 mb-4">Ingresa tu email y te enviaremos un link.</p>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="w-full h-11 rounded-xl border border-gray-200 bg-brand-light/50 px-4 text-sm text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                  autoFocus
                />
                <div className="flex gap-2 mt-4">
                  <button type="button" onClick={() => setShowForgot(false)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-brand-gray hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button type="submit" disabled={forgotLoading}
                    className="flex-1 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-70">
                    {forgotLoading ? "Enviando..." : "Enviar link"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Version */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-brand-gray/50">re-booking v1.0</p>

      {/* Change Password Modal (first login for new tenants) */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-5">
              <img src="/oti/confirmado.png" alt="Oti" className="w-16 h-16 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-brand-dark">Bienvenido a re-booking!</h3>
              <p className="text-sm text-brand-gray mt-1">Por seguridad, elige una nueva contrasena</p>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-brand-gray block mb-1">Nueva contrasena</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  required minLength={6} placeholder="Minimo 6 caracteres"
                  className="w-full h-11 rounded-xl border border-gray-200 bg-brand-light/50 px-4 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-brand-gray block mb-1">Confirmar contrasena</label>
                <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required minLength={6} placeholder="Repite la contrasena"
                  className="w-full h-11 rounded-xl border border-gray-200 bg-brand-light/50 px-4 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
              </div>
              {changeError && <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg py-2">{changeError}</p>}
              <button type="submit" disabled={changingPassword}
                className="w-full h-11 rounded-xl bg-brand-blue text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-70 flex items-center justify-center gap-2">
                {changingPassword ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                ) : "Guardar y continuar"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
