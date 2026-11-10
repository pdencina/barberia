"use client";

import { useEffect, useState } from "react";
import { api, apiPatch, BUTTON, CARD, errorText, INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";

function Ajustes() {
  const { data, error, reload } = useApi<{ settings: any; missingMigration: boolean }>("config");
  const warehouses = useApi<{ warehouses: any[] }>("bodegas");
  const [s, setS] = useState<any>(null);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  useEffect(() => { if (data?.settings) setS(data.settings); }, [data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({});
    try {
      await apiPatch("config", {
        contactEveryDays: Number(s.contactEveryDays), noAnswerRetryDays: Number(s.noAnswerRetryDays), maxNoAnswerAttempts: Number(s.maxNoAnswerAttempts),
        weeklyReportEnabled: s.weeklyReportEnabled, portalEnabled: s.portalEnabled, portalStockMode: s.portalStockMode,
        portalShowPrices: s.portalShowPrices, portalWarehouseId: s.portalWarehouseId || null,
      });
      setMsg({ ok: "Guardado." });
      reload();
    } catch (err) {
      setMsg({ error: errorText(err) });
    }
  };

  if (error) return <Message error={error} />;
  if (!s) return <p className="text-sm text-gray-500">Cargando...</p>;
  const num = (key: string, label: string, min: number, max: number) => (
    <label className="block text-sm text-brand-dark">{label}
      <input type="number" min={min} max={max} className={`${INPUT} mt-1`} value={s[key]} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
    </label>
  );
  const check = (key: string, label: string) => (
    <label className="flex items-center gap-2 text-sm text-brand-dark">
      <input type="checkbox" checked={!!s[key]} onChange={(e) => setS({ ...s, [key]: e.target.checked })} /> {label}
    </label>
  );
  return (
    <form onSubmit={save} className="space-y-4">
      {data?.missingMigration && <Message error="Falta aplicar la migración 158: estos ajustes todavía no se pueden guardar." />}
      <div className={`${CARD} space-y-3`}>
        <p className="font-semibold text-brand-dark">Llamados de los vendedores</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {num("contactEveryDays", "Llamar a cada cliente cada (días)", 1, 365)}
          {num("noAnswerRetryDays", "Si no contesta, reintentar en (días)", 0, 60)}
          {num("maxNoAnswerAttempts", "Intentos sin respuesta antes de pasar al próximo ciclo", 1, 20)}
        </div>
        {check("weeklyReportEnabled", "Enviar el reporte semanal por correo a los dueños (lunes en la mañana)")}
      </div>
      <div className={`${CARD} space-y-3`}>
        <p className="font-semibold text-brand-dark">Portal de distribuidores</p>
        <p className="text-sm text-gray-600">Ábrelo cuando el stock ya cuadre: mostrar stock equivocado a los distribuidores empeora el problema.</p>
        {check("portalEnabled", "Portal abierto")}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-brand-dark">Qué ven del stock
            <select className={`${INPUT} mt-1`} value={s.portalStockMode} onChange={(e) => setS({ ...s, portalStockMode: e.target.value })}>
              <option value="availability">Solo “Disponible / Agotado”</option>
              <option value="exact">La cantidad exacta</option>
            </select>
          </label>
          <label className="block text-sm text-brand-dark">Bodega del portal
            <select className={`${INPUT} mt-1`} value={s.portalWarehouseId || ""} onChange={(e) => setS({ ...s, portalWarehouseId: e.target.value })}>
              <option value="">La primera bodega activa</option>
              {warehouses.data?.warehouses.filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        </div>
        {check("portalShowPrices", "Mostrar precios de lista")}
      </div>
      <button className={BUTTON}>Guardar</button>
      <Message {...msg} />
    </form>
  );
}

function AccesosPortal() {
  const { data, error, reload } = useApi<{ partners: any[] }>("socios");
  const customers = useApi<{ customers: any[] }>("clientes");
  const [form, setForm] = useState({ customerId: "", name: "", email: "", password: "" });
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const distributors = (customers.data?.customers || []).filter((c) => c.customer_type === "distributor" && c.active);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({});
    try {
      await api("socios", form);
      setMsg({ ok: `Acceso creado. ${form.name} entra en re-booking.cl/socios/login con su correo y esa contraseña.` });
      setForm({ customerId: "", name: "", email: "", password: "" });
      reload();
    } catch (err) {
      setMsg({ error: errorText(err) });
    }
  };
  const patch = async (userId: string, body: Record<string, unknown>, ok: string) => {
    setMsg({});
    try { await apiPatch(`socios/${userId}`, body); setMsg({ ok }); reload(); } catch (err) { setMsg({ error: errorText(err) }); }
  };

  return (
    <div className="space-y-3">
      <p className="font-semibold text-brand-dark">Accesos al portal</p>
      <form onSubmit={create} className={`${CARD} grid gap-2 sm:grid-cols-2 lg:grid-cols-5`}>
        <select aria-label="Distribuidor" required className={INPUT} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
          <option value="">Distribuidor...</option>
          {distributors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input aria-label="Nombre" required className={INPUT} placeholder="Nombre de la persona" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input aria-label="Correo" required type="email" className={INPUT} placeholder="Correo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input aria-label="Contraseña inicial" required minLength={8} autoComplete="new-password" className={INPUT} placeholder="Contraseña inicial" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className={BUTTON}>Dar acceso</button>
        <div className="sm:col-span-2 lg:col-span-5"><Message {...msg} /></div>
      </form>
      {distributors.length === 0 && <p className="text-xs text-gray-500">Primero marca un cliente como “Distribuidor” en Clientes.</p>}
      <Message error={error} />
      <Table head={["Distribuidor", "Persona", "Correo", "Estado", ""]}>
        {data?.partners.map((p) => (
          <tr key={p.userId}>
            <td className={TD}>{p.customerName}</td>
            <td className={TD}>{p.name}</td>
            <td className={TD}>{p.email}</td>
            <td className={TD}>{p.active ? "Activo" : <span className="text-gray-400">Desactivado</span>}</td>
            <td className={`${TD} space-x-3 whitespace-nowrap`}>
              <button className="text-sm text-brand-blue underline" onClick={() => patch(p.userId, { active: !p.active }, p.active ? "Acceso desactivado." : "Acceso activado.")}>{p.active ? "Desactivar" : "Activar"}</button>
              <button className="text-sm text-brand-blue underline" onClick={() => { const pw = window.prompt("Nueva contraseña (mínimo 8 caracteres):"); if (pw) patch(p.userId, { password: pw }, "Contraseña cambiada."); }}>Cambiar contraseña</button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export default function ConfigPage() {
  return (
    <div className="space-y-6">
      <Title>Configuración</Title>
      <Ajustes />
      <AccesosPortal />
    </div>
  );
}
