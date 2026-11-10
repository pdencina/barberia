"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAppCache } from "@/lib/swr-cache";
import { createClient } from "@/lib/supabase/client";

const INPUT = "flex h-11 w-full rounded-xl border border-gray-200 bg-brand-light/50 px-4 text-sm text-brand-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue";

// Solo comodidad: el acceso real lo revisa el servidor en cada página y cada ruta del portal.
export default function SociosLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("cerrado") === "1") setError("El portal no está disponible por ahora.");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    clearAppCache();
    await supabase.auth.signOut();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("Credenciales incorrectas");
      setLoading(false);
      return;
    }
    const me = await fetch("/api/socios/me");
    if (!me.ok) {
      const body = await me.json().catch(() => ({}));
      await supabase.auth.signOut();
      setError(me.status === 403 && body.error ? body.error : "Esta cuenta no tiene acceso al portal de distribuidores.");
      setLoading(false);
      return;
    }
    router.push("/socios");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-brand-dark">Portal de distribuidores</h1>
          <p className="text-sm text-gray-500">Revisa el stock y haz tus pedidos en línea.</p>
        </div>
        <input className={INPUT} type="email" autoComplete="username" required placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={INPUT} type="password" autoComplete="current-password" required placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="rounded-lg bg-red-50 py-2 text-center text-xs text-red-600">{error}</p>}
        <button disabled={loading} className="h-11 w-full rounded-xl bg-brand-blue text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-70">
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
