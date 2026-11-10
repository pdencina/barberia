"use client";

import { useState } from "react";
import { api, BUTTON, CARD, errorText, INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";

const AUDIENCE: Record<string, string> = { all: "Todos con permiso", clients: "Clientes", distributors: "Distribuidores" };
const STATUS: Record<string, string> = { scheduled: "Programada", sending: "Enviando", done: "Terminada", cancelled: "Cancelada" };
const en1h = () => {
  const d = new Date(Date.now() + 3600e3);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function CampanasPage() {
  const { data, error, reload } = useApi<any>("campanas");
  const [form, setForm] = useState({ name: "", templateName: "", templateLanguage: "es", audience: "all", when: en1h() });
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({});
    try {
      // datetime-local está en la hora del navegador; se convierte a un instante exacto antes de enviarlo.
      await api("campanas", { ...form, scheduledAt: new Date(form.when).toISOString() });
      setMsg({ ok: "Campaña programada." });
      setForm({ ...form, name: "" });
      reload();
    } catch (err) {
      setMsg({ error: errorText(err) });
    }
  };
  const cancel = async (id: string) => {
    setMsg({});
    try { await api(`campanas/${id}`, { action: "cancel" }); setMsg({ ok: "Campaña cancelada." }); reload(); } catch (err) { setMsg({ error: errorText(err) }); }
  };

  return (
    <div className="space-y-4">
      <Title>Campañas por WhatsApp</Title>
      {data && !data.realSending && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Modo simulado: las campañas se procesan y se cuentan, pero <b>no se envía ningún mensaje</b> hasta que se active el envío real
          (número de WhatsApp de la empresa, plantillas aprobadas por Meta y la aprobación de Nico).
        </p>
      )}
      <form onSubmit={create} className={`${CARD} grid gap-2 sm:grid-cols-2 lg:grid-cols-3`}>
        <input aria-label="Nombre" required className={INPUT} placeholder="Nombre (ej.: Lanzamiento de verano)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input aria-label="Plantilla" required className={INPUT} placeholder="Plantilla de Meta (ej.: promo_verano)" value={form.templateName} onChange={(e) => setForm({ ...form, templateName: e.target.value.toLowerCase() })} />
        <input aria-label="Idioma" className={INPUT} placeholder="Idioma (es)" value={form.templateLanguage} onChange={(e) => setForm({ ...form, templateLanguage: e.target.value })} />
        <select aria-label="A quién" className={INPUT} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
          {Object.entries(AUDIENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input aria-label="Fecha y hora" type="datetime-local" required className={INPUT} value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} />
        <button className={BUTTON}>Programar</button>
        <div className="sm:col-span-2 lg:col-span-3"><Message {...msg} /></div>
      </form>
      <p className="text-sm text-gray-600">
        Solo reciben los clientes con <b>permiso de WhatsApp</b> marcado en Clientes ({data?.optedIn ?? 0} hoy) y que no se hayan dado de baja.
        Una campaña nunca le llega dos veces a la misma persona.
      </p>
      <Message error={error} />
      <Table head={["Campaña", "Plantilla", "A quién", "Cuándo", "Estado", "Resultado", ""]}>
        {data?.campaigns.map((c: any) => (
          <tr key={c.id}>
            <td className={TD}>{c.name}</td>
            <td className={TD}>{c.template_name}</td>
            <td className={TD}>{AUDIENCE[c.audience]}</td>
            <td className={TD}>{new Date(c.scheduled_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</td>
            <td className={TD}>{STATUS[c.status]}</td>
            <td className={`${TD} text-xs`}>
              {Object.keys(c.counts).length === 0 ? "-" : Object.entries(c.counts).map(([k, v]) => `${({ simulated: "simulados", sent: "enviados", failed: "fallidos", uncertain: "sin confirmar", skipped_optout: "de baja", skipped_no_phone: "sin celular" } as any)[k] || k}: ${v}`).join(" · ")}
            </td>
            <td className={TD}>{(c.status === "scheduled" || c.status === "sending") && <button className="text-sm text-red-700 underline" onClick={() => cancel(c.id)}>Cancelar</button>}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
