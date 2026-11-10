"use client";

import { useEffect, useState } from "react";
import { api, apiPatch, BUTTON, BUTTON_LIGHT, CARD, errorText, INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";

const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
type TierForm = { id?: string; name: string; discountPct: string; minAmount: string; maxAmount: string };
const toForm = (t: any): TierForm => ({ id: t.id, name: t.name, discountPct: String(t.discountPct), minAmount: t.minAmount == null ? "" : String(t.minAmount), maxAmount: t.maxAmount == null ? "" : String(t.maxAmount) });

// Tramos de precio mayorista: descuento sobre el precio de lista. El rango de compras del mes solo sugiere el tramo.
function TramosPrecio() {
  const { data, error, reload } = useApi<any>("precios");
  const [tiers, setTiers] = useState<TierForm[] | null>(null);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  useEffect(() => {
    if (!data) return;
    setTiers((data.tiers.filter((t: any) => t.active).length ? data.tiers.filter((t: any) => t.active) : data.defaults || []).map(toForm));
  }, [data]);
  const set = (i: number, patch: Partial<TierForm>) => setTiers(tiers!.map((t, n) => (n === i ? { ...t, ...patch } : t)));
  const save = async () => {
    setMsg({});
    try {
      const res = await fetch("/api/empresa/precios", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiers: tiers!.map((t) => ({ id: t.id, name: t.name, discountPct: Number(t.discountPct), minAmount: t.minAmount === "" ? null : Number(t.minAmount), maxAmount: t.maxAmount === "" ? null : Number(t.maxAmount) })) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo guardar.");
      setMsg({ ok: "Tramos guardados." });
      reload();
    } catch (e) {
      setMsg({ error: errorText(e) });
    }
  };
  const assign = async (customerId: string, tierId: string) => {
    setMsg({});
    try { await apiPatch(`clientes/${customerId}`, { priceTierId: tierId || null }); reload(); } catch (e) { setMsg({ error: errorText(e) }); }
  };

  if (error) return <Message error={error} />;
  if (!tiers) return <p className="text-sm text-gray-500">Cargando...</p>;
  const saved = data.tiers.filter((t: any) => t.active);
  const nameOf = (id: string | null) => saved.find((t: any) => t.id === id)?.name || "Precio de lista";
  return (
    <div className="space-y-3">
      <p className="font-semibold text-brand-dark">Tramos de precio mayorista</p>
      <div className={`${CARD} space-y-2`}>
        {data.defaults && saved.length === 0 && <p className="text-sm text-amber-800">Propuesta con lo que contó Felipe. Revísala y aprieta Guardar. Falta definir el tramo entre $5 y $6 millones y sobre $10 millones.</p>}
        {tiers.map((t, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1.3fr_1.3fr_auto]">
            <input aria-label="Nombre del tramo" className={INPUT} value={t.name} onChange={(e) => set(i, { name: e.target.value })} />
            <input aria-label="Descuento %" type="number" min={0} max={90} step="0.5" className={INPUT} placeholder="% desc." value={t.discountPct} onChange={(e) => set(i, { discountPct: e.target.value })} />
            <input aria-label="Compras desde" type="number" min={0} className={INPUT} placeholder="Compras desde $" value={t.minAmount} onChange={(e) => set(i, { minAmount: e.target.value })} />
            <input aria-label="Compras hasta" type="number" min={0} className={INPUT} placeholder="hasta $ (vacío = sin tope)" value={t.maxAmount} onChange={(e) => set(i, { maxAmount: e.target.value })} />
            <button className={BUTTON_LIGHT} onClick={() => setTiers(tiers.filter((_, n) => n !== i))} aria-label={`Quitar ${t.name}`}>×</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button className={BUTTON_LIGHT} onClick={() => setTiers([...tiers, { name: "", discountPct: "0", minAmount: "", maxAmount: "" }])}>Agregar tramo</button>
          <button className={BUTTON} onClick={save}>Guardar tramos</button>
        </div>
        <p className="text-xs text-gray-500">El descuento se aplica al precio de lista en los pedidos del vendedor y del portal. Los pedidos ya creados no cambian.</p>
      </div>
      <Message {...msg} />
      {saved.length > 0 && data.distributors.length > 0 && (
        <Table head={["Distribuidor", `Compras de ${data.month}`, "Sugerido", "Tramo asignado"]}>
          {data.distributors.map((d: any) => (
            <tr key={d.customerId}>
              <td className={TD}>{d.name}</td>
              <td className={TD}>{clp(d.lastMonth)}</td>
              <td className={TD}>{d.suggestedTierId ? nameOf(d.suggestedTierId) : "-"}{d.suggestedTierId && d.suggestedTierId !== d.tierId && <span className="ml-1 text-xs text-amber-700">(distinto)</span>}</td>
              <td className={TD}>
                <select aria-label={`Tramo de ${d.name}`} className={`${INPUT} h-8 w-auto`} value={d.tierId || ""} onChange={(e) => assign(d.customerId, e.target.value)}>
                  <option value="">Precio de lista</option>
                  {saved.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.discountPct}%)</option>)}
                </select>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

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
      <TramosPrecio />
      <AccesosPortal />
    </div>
  );
}
