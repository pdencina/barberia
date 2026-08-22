"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { useTenant } from "@/lib/tenant-context";
import { formatCurrency } from "@/lib/utils";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  admin_email: string;
  admin_name: string | null;
  phone: string | null;
  max_professionals: number;
  trial_ends_at: string | null;
  active: boolean;
  created_at: string;
  subscription: Array<{ plan: string; status: string; current_period_end: string | null }>;
}

const statusColors: Record<string, string> = {
  trial: "bg-yellow-100 text-yellow-700",
  active: "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-700",
};

const planColors: Record<string, string> = {
  starter: "bg-blue-100 text-blue-700",
  pro: "bg-purple-100 text-purple-700",
  enterprise: "bg-indigo-100 text-indigo-700",
};

export default function SuperAdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string; slug: string } | null>(null);
  const [form, setForm] = useState({
    name: "", slug: "", admin_email: "", admin_name: "", phone: "", address: "", rut_empresa: "", plan: "basic",
  });
  const { showToast } = useToast();
  const { switchTenant } = useTenant();

  const fetchTenants = async () => {
    setLoading(true);
    const res = await fetch("/api/superadmin/tenants");
    setTenants(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchTenants(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    const res = await fetch("/api/superadmin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setCreating(false);

    if (res.ok) {
      setCreatedInfo({ email: form.admin_email, password: data.temp_password, slug: form.slug });
      setShowCreate(false);
      setForm({ name: "", slug: "", admin_email: "", admin_name: "", phone: "", address: "", rut_empresa: "", plan: "starter" });
      fetchTenants();
      showToast("Empresa creada exitosamente", "success");
    } else {
      showToast(data.error || "Error al crear", "error");
    }
  };

  const daysLeft = (date: string | null): number => {
    if (!date) return 0;
    return Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://re-booking.cl";

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brand-dark">Empresas</h1>
          <p className="text-sm text-brand-gray">Gestiona las empresas contratantes de re-booking</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-brand-blue text-white text-sm font-medium rounded-xl hover:bg-blue-700 shadow-md shadow-brand-blue/20">
          + Nueva Empresa
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-brand-dark">{tenants.length}</p>
          <p className="text-xs text-brand-gray">Total empresas</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{tenants.filter((t) => t.status === "active").length}</p>
          <p className="text-xs text-brand-gray">Activas</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{tenants.filter((t) => t.status === "trial").length}</p>
          <p className="text-xs text-brand-gray">En trial</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-brand-blue">{tenants.reduce((s, t) => s + t.max_professionals, 0)}</p>
          <p className="text-xs text-brand-gray">Profesionales total</p>
        </div>
      </div>

      {/* Created info banner */}
      {createdInfo && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-green-800">Empresa creada! Credenciales enviadas por email.</p>
              <div className="mt-2 text-sm text-green-700 space-y-1">
                <p><strong>Email:</strong> {createdInfo.email}</p>
                <p><strong>contraseña temporal:</strong> <code className="bg-green-200 px-2 py-0.5 rounded">{createdInfo.password}</code></p>
                <p><strong>URL:</strong> {appUrl}/login</p>
              </div>
            </div>
            <button onClick={() => setCreatedInfo(null)} className="text-green-600 hover:text-green-800">âœ•</button>
          </div>
        </div>
      )}

      {/* Tenant list */}
      {loading ? (
        <div className="text-center py-12 text-brand-gray">Cargando...</div>
      ) : tenants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <img src="/oti/oti-face-128.png" alt="Oti" className="w-20 h-20 mx-auto mb-3" />
          <p className="text-brand-gray">No hay empresas registradas aun</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 bg-brand-blue text-white text-sm rounded-xl">
            Crear primera empresa
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue font-bold text-sm">
                    {t.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-brand-dark">{t.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${planColors[t.plan] || ""}`}>
                        {t.plan}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[t.status] || ""}`}>
                        {t.status === "trial" ? `Trial (${daysLeft(t.trial_ends_at)}d)` : t.status}
                      </span>
                    </div>
                    <p className="text-xs text-brand-gray mt-0.5">
                      {t.admin_email} Â· /{t.slug} Â· {t.max_professionals} profesionales max
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-xs text-brand-gray">
                    {new Date(t.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  {t.trial_ends_at && (
                    <p className={`text-[10px] ${daysLeft(t.trial_ends_at) <= 3 ? "text-red-500 font-bold" : "text-brand-gray"}`}>
                      Expira: {new Date(t.trial_ends_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                    </p>
                  )}
                  {t.status === "trial" && daysLeft(t.trial_ends_at) <= 10 && (
                    <button className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-bold rounded hover:bg-orange-200">
                      Enviar recordatorio
                    </button>
                  )}
                  <button
                    onClick={() => switchTenant(t.id, t.name)}
                    className="mt-1 px-3 py-1.5 bg-brand-blue text-white text-xs font-medium rounded-lg hover:bg-brand-blue/90 transition-colors"
                  >
                    Entrar â†’
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-brand-dark mb-1">Nueva Empresa</h2>
            <p className="text-sm text-brand-gray mb-5">Se creara un admin con contraseña temporal y se le enviara email</p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-brand-gray block mb-1">Nombre de la empresa *</label>
                  <input type="text" required value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") })}
                    placeholder="Ej: Mi Negocio Premium"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-gray block mb-1">Slug (URL) *</label>
                  <input type="text" required value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                    placeholder="mi-negocio"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-gray block mb-1">RUT Empresa</label>
                  <input type="text" value={form.rut_empresa}
                    onChange={(e) => setForm({ ...form, rut_empresa: e.target.value })}
                    placeholder="76.123.456-7"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-gray block mb-1">Email admin *</label>
                  <input type="email" required value={form.admin_email}
                    onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                    placeholder="admin@empresa.cl"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-gray block mb-1">Nombre admin</label>
                  <input type="text" value={form.admin_name}
                    onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                    placeholder="Juan Perez"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-gray block mb-1">Telefono</label>
                  <input type="text" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+56 9 1234 5678"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-gray block mb-1">Direccion</label>
                  <input type="text" value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Calle 123, Ciudad"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-brand-gray block mb-1">Plan</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "basic", label: "Basic", desc: "1 prof Â· $8.900/mes" },
                      { key: "starter", label: "Starter", desc: "3 prof Â· $29.990/mes" },
                      { key: "pro", label: "Pro", desc: "8 prof Â· $49.990/mes" },
                      { key: "enterprise", label: "Enterprise", desc: "Ilimitado Â· $189.990/mes" },
                    ].map((p) => (
                      <button key={p.key} type="button" onClick={() => setForm({ ...form, plan: p.key })}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${form.plan === p.key ? "border-brand-blue bg-brand-blue/5" : "border-gray-200 hover:border-gray-300"}`}>
                        <p className="text-sm font-bold text-brand-dark">{p.label}</p>
                        <p className="text-[10px] text-brand-gray">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-3 text-xs text-brand-blue">
                Se generara una contraseña temporal y se enviara por email al admin. Trial de 15 dias incluido.
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-brand-gray hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={creating || !form.name || !form.slug || !form.admin_email}
                  className="flex-1 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {creating ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creando...</>
                  ) : "Crear Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
