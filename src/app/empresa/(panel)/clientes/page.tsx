"use client";

import { useState } from "react";
import { useCan } from "@/components/empresa/shell";
import { api, BUTTON, CARD, INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";

const EMPTY = { name: "", taxId: "", contactName: "", phone: "", email: "", city: "", customerType: "client" };

export default function ClientesPage() {
  const can = useCan();
  const { data, error, reload } = useApi<{ customers: any[] }>("clientes");
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({});
    try {
      await api("clientes", form);
      setForm(EMPTY);
      setMsg({ ok: "Cliente creado." });
      reload();
    } catch (err) {
      setMsg({ error: err instanceof Error ? err.message : "No se pudo crear." });
    }
  };

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
          <button className={BUTTON}>Crear</button>
          <div className="sm:col-span-3 lg:col-span-4"><Message {...msg} /></div>
        </form>
      )}
      <Message error={error} />
      <Table head={["Nombre", "RUT", "Contacto", "Celular", "Ciudad", "Tipo"]}>
        {data?.customers.map((c) => (
          <tr key={c.id}>
            <td className={TD}>{c.name}</td>
            <td className={TD}>{c.tax_id || "-"}</td>
            <td className={TD}>{c.contact_name || "-"}</td>
            <td className={TD}>{c.phone || "-"}</td>
            <td className={TD}>{c.city || "-"}</td>
            <td className={TD}>{c.customer_type === "distributor" ? "Distribuidor" : "Cliente"}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
