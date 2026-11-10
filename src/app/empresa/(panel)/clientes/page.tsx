"use client";

import { useState } from "react";
import { useCan } from "@/components/empresa/shell";
import { api, apiPatch, BUTTON, CARD, errorText, INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";

const EMPTY = { name: "", taxId: "", contactName: "", phone: "", email: "", city: "", customerType: "client", whatsappOptIn: false };

export default function ClientesPage() {
  const can = useCan();
  const { data, error, reload } = useApi<{ customers: any[]; warning?: string }>("clientes");
  const team = useApi<{ members: any[] }>("usuarios");
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const assign = can("cartera.asignar");
  const sellers = (team.data?.members || []).filter((m) => m.active && (m.role === "seller" || m.role === "owner"));
  const sellerName = (id: string | null) => (id ? sellers.find((s) => s.userId === id)?.name || "Otro" : "-");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({});
    try {
      await api("clientes", form);
      setForm(EMPTY);
      setMsg({ ok: "Cliente creado." });
      reload();
    } catch (err) {
      setMsg({ error: errorText(err, "No se pudo crear.") });
    }
  };
  const patch = async (id: string, body: Record<string, unknown>) => {
    setMsg({});
    try { await apiPatch(`clientes/${id}`, body); reload(); } catch (err) { setMsg({ error: errorText(err) }); }
  };

  const q = search.trim().toLowerCase();
  const rows = (data?.customers || []).filter((c) => !q || [c.name, c.tax_id, c.contact_name, c.city].some((v) => (v || "").toLowerCase().includes(q)));

  return (
    <div className="space-y-4">
      <Title>Clientes comerciales</Title>
      {can("clientes.editar") && (
        <form onSubmit={submit} className={`${CARD} grid gap-2 sm:grid-cols-3 lg:grid-cols-4`}>
          <input aria-label="Nombre" required className={INPUT} placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input aria-label="RUT" className={INPUT} placeholder="RUT" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
          <input aria-label="Contacto" className={INPUT} placeholder="Contacto" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          <input aria-label="Celular" className={INPUT} placeholder="Celular" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input aria-label="Correo" type="email" className={INPUT} placeholder="Correo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input aria-label="Ciudad" className={INPUT} placeholder="Ciudad" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <select aria-label="Tipo de cliente" className={INPUT} value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
            <option value="client">Cliente</option>
            <option value="distributor">Distribuidor</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-brand-dark">
            <input type="checkbox" checked={form.whatsappOptIn} onChange={(e) => setForm({ ...form, whatsappOptIn: e.target.checked })} />
            Aceptó recibir WhatsApp
          </label>
          <button className={BUTTON}>Crear</button>
          <div className="sm:col-span-3 lg:col-span-4"><Message {...msg} /></div>
        </form>
      )}
      <Message error={error || data?.warning} />
      <input aria-label="Buscar cliente" className={`${INPUT} sm:w-80`} placeholder="Buscar por nombre, RUT, contacto o ciudad" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Table head={["Nombre", "RUT", "Contacto", "Celular", "Ciudad", "Tipo", "Vendedor", "WhatsApp"]}>
        {rows.map((c) => (
          <tr key={c.id} className={c.active ? "" : "opacity-50"}>
            <td className={TD}>{c.name}</td>
            <td className={TD}>{c.tax_id || "-"}</td>
            <td className={TD}>{c.contact_name || "-"}</td>
            <td className={TD}>{c.phone || "-"}</td>
            <td className={TD}>{c.city || "-"}</td>
            <td className={TD}>
              {assign ? (
                <select aria-label={`Tipo de ${c.name}`} className={`${INPUT} h-8 w-auto`} value={c.customer_type} onChange={(e) => patch(c.id, { customerType: e.target.value })}>
                  <option value="client">Cliente</option>
                  <option value="distributor">Distribuidor</option>
                </select>
              ) : c.customer_type === "distributor" ? "Distribuidor" : "Cliente"}
            </td>
            <td className={TD}>
              {assign && "assigned_seller_id" in c ? (
                <select aria-label={`Vendedor de ${c.name}`} className={`${INPUT} h-8 w-auto`} value={c.assigned_seller_id || ""} onChange={(e) => patch(c.id, { sellerId: e.target.value || null })}>
                  <option value="">Sin vendedor</option>
                  {sellers.map((s) => <option key={s.userId} value={s.userId}>{s.name}</option>)}
                </select>
              ) : sellerName(c.assigned_seller_id ?? null)}
            </td>
            <td className={TD}>
              {"whatsapp_opt_in" in c && can("clientes.editar") ? (
                <input aria-label={`Permiso de WhatsApp de ${c.name}`} type="checkbox" checked={!!c.whatsapp_opt_in} onChange={(e) => patch(c.id, { whatsappOptIn: e.target.checked })} />
              ) : c.whatsapp_opt_in ? "Sí" : "-"}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
