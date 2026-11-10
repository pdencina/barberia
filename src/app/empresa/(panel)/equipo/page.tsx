"use client";

import { useState } from "react";
import { api, apiPatch, BUTTON, CARD, errorText, INPUT, Message, ROLE_LABEL, Table, TD, Title, useApi } from "@/components/empresa/ui";

const EMPTY = { name: "", email: "", role: "seller", password: "" };

export default function EquipoPage() {
  const { data, error, reload } = useApi<{ members: any[] }>("usuarios");
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({});
    try {
      await api("usuarios", form);
      setMsg({ ok: `Cuenta creada. Entrégale a ${form.name} su correo y la contraseña; entra por re-booking.cl › Empresas.` });
      setForm(EMPTY);
      reload();
    } catch (err) {
      setMsg({ error: errorText(err) });
    }
  };
  const patch = async (userId: string, body: Record<string, unknown>, ok: string) => {
    setMsg({});
    try {
      await apiPatch(`usuarios/${userId}`, body);
      setMsg({ ok });
      reload();
    } catch (err) {
      setMsg({ error: errorText(err) });
    }
  };
  const resetPassword = (m: any) => {
    const pw = window.prompt(`Nueva contraseña para ${m.name} (mínimo 8 caracteres):`);
    if (pw) patch(m.userId, { password: pw }, "Contraseña cambiada.");
  };

  return (
    <div className="space-y-4">
      <Title>Equipo</Title>
      <form onSubmit={create} className={`${CARD} grid gap-2 sm:grid-cols-2 lg:grid-cols-5`}>
        <input aria-label="Nombre" required className={INPUT} placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input aria-label="Correo" required type="email" className={INPUT} placeholder="Correo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <select aria-label="Rol" className={INPUT} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="seller">Vendedor</option>
          <option value="warehouse">Bodega</option>
          <option value="owner">Dueño</option>
        </select>
        <input aria-label="Contraseña inicial" required minLength={8} type="text" autoComplete="new-password" className={INPUT} placeholder="Contraseña inicial" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className={BUTTON}>Crear cuenta</button>
        <div className="sm:col-span-2 lg:col-span-5"><Message {...msg} /></div>
      </form>
      <Message error={error} />
      <Table head={["Nombre", "Correo", "Rol", "Estado", ""]}>
        {data?.members.map((m) => (
          <tr key={m.userId}>
            <td className={TD}>{m.name || "-"}</td>
            <td className={TD}>{m.email || "-"}</td>
            <td className={TD}>
              <select aria-label={`Rol de ${m.name}`} className={`${INPUT} h-8 w-auto`} value={m.role} onChange={(e) => patch(m.userId, { role: e.target.value }, "Rol actualizado.")}>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </td>
            <td className={TD}>{m.active ? "Activo" : <span className="text-gray-400">Desactivado</span>}</td>
            <td className={`${TD} space-x-3 whitespace-nowrap`}>
              <button className="text-sm text-brand-blue underline" onClick={() => patch(m.userId, { active: !m.active }, m.active ? "Cuenta desactivada." : "Cuenta activada.")}>{m.active ? "Desactivar" : "Activar"}</button>
              <button className="text-sm text-brand-blue underline" onClick={() => resetPassword(m)}>Cambiar contraseña</button>
            </td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-gray-500">Dueño: todo. Vendedor: su cola, sus clientes y sus pedidos. Bodega: stock, conteos y despacho. Siempre queda al menos un dueño activo.</p>
    </div>
  );
}
