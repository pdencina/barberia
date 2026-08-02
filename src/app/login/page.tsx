"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Clear any existing session first
    await supabase.auth.signOut();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Credenciales incorrectas");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-xl shadow-blue-900/5 p-6 md:p-8 animate-scale-in">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="re-booking" className="h-12 md:h-14 w-auto mx-auto mb-3" />
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
              className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-brand-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-brand-gray">
              Contrasena
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-brand-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all"
            />
          </div>
          {error && (
            <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-brand-blue text-white text-sm font-bold uppercase tracking-wider hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
