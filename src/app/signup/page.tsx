"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [form, setForm] = useState({
    businessType: "",
    professionals: "",
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push("/login"), 2000);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-light p-4">
        <div className="w-full max-w-sm text-center rounded-2xl bg-white shadow-xl p-8">
          <img src="/logo-icon.png" alt="re-booking" className="w-20 h-20 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-brand-dark">Cuenta creada</h2>
          <p className="text-sm text-brand-gray mt-2">Tu negocio esta listo. Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <Link href="/landing">
            <img src="/logo-icon.png" alt="re-booking" className="w-14 h-14 mx-auto mb-2" />
          </Link>
          <img src="/logo-horizontal.png" alt="re-booking" className="h-7 w-auto mx-auto mb-3" />
          <h1 className="text-xl font-bold text-brand-dark">Registra tu negocio</h1>
          <p className="text-sm text-brand-gray mt-1">
            Publica tu negocio y gestiona tus reservas, clientes y pagos en un solo lugar.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-brand-gray mb-1">Que tipo de negocio tienes?</label>
              <select value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-brand-dark">
                <option value="">Seleccionar...</option>
                <option value="barberia">Barberia</option>
                <option value="peluqueria">Peluqueria</option>
                <option value="salon_belleza">Salon de Belleza</option>
                <option value="spa">Spa</option>
                <option value="estetica">Centro de Estetica</option>
                <option value="clinica">Clinica / Salud</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-gray mb-1">Cuantos profesionales atienden?</label>
              <select value={form.professionals} onChange={(e) => setForm({ ...form, professionals: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-brand-dark">
                <option value="">Seleccionar...</option>
                <option value="1">Solo yo (1 profesional)</option>
                <option value="2-3">2 a 3 profesionales</option>
                <option value="4-6">4 a 6 profesionales</option>
                <option value="7-10">7 a 10 profesionales</option>
                <option value="10+">Mas de 10 profesionales</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-gray mb-1">Tu nombre y apellido</label>
              <input type="text" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nico Perez"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-gray mb-1">Email</label>
              <input type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="tu@email.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-2">
              <div>
                <label className="block text-xs font-medium text-brand-gray mb-1">Pais</label>
                <select className="w-full border border-gray-200 rounded-xl px-2 py-2.5 text-sm" disabled>
                  <option>Chile</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-gray mb-1">Telefono</label>
                <input type="tel" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="9 1234 5678"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-gray mb-1">Crea tu contraseña</label>
              <input type="password" required minLength={6} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimo 6 caracteres"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>

            {error && <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg py-2">{error}</p>}

            <button type="submit" disabled={loading || !form.name || !form.email || !form.password}
              className="w-full py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-brand-blue/90 disabled:opacity-50 transition-all shadow-lg shadow-brand-blue/20">
              {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
            </button>

            <p className="text-[11px] text-brand-gray text-center">
              Al crear tu cuenta aceptas nuestros{" "}
              <a href="/terminos" className="text-brand-blue underline">terminos y condiciones</a>
              {" "}y{" "}
              <a href="/privacidad" className="text-brand-blue underline">politica de privacidad</a>.
            </p>
          </form>
        </div>

        {/* Login link */}
        <p className="text-center text-sm text-brand-gray mt-4">
          Ya tienes una cuenta?{" "}
          <Link href="/login" className="text-brand-blue font-medium hover:underline">Inicia sesion aqui</Link>
        </p>
      </div>
    </div>
  );
}
