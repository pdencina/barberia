"use client";

import { useState } from "react";
import { api, apiPatch, BUTTON, CARD, errorText, INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";

export default function MarcasPage() {
  const { data, error, reload } = useApi<{ brands: any[] }>("marcas");
  const products = useApi<{ products: any[] }>("productos");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  const count = (id: string) => (products.data?.products || []).filter((p) => p.brand_id === id && p.active).length;
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({});
    try {
      await api("marcas", { name });
      setMsg({ ok: `Marca "${name}" creada. Asígnale productos en Productos o con la columna "Marca" al importar.` });
      setName("");
      reload();
    } catch (err) {
      setMsg({ error: errorText(err) });
    }
  };
  const patch = async (id: string, body: Record<string, unknown>) => {
    setMsg({});
    try { await apiPatch(`marcas/${id}`, body); reload(); } catch (err) { setMsg({ error: errorText(err) }); }
  };
  const rename = (b: any) => {
    const n = window.prompt("Nuevo nombre de la marca:", b.name);
    if (n && n.trim() && n.trim() !== b.name) patch(b.id, { name: n.trim() });
  };

  return (
    <div className="space-y-4">
      <Title>Marcas</Title>
      <form onSubmit={create} className={`${CARD} flex flex-wrap gap-2`}>
        <input aria-label="Nombre de la marca" required className={`${INPUT} sm:w-72`} placeholder="Nombre de la marca (ej.: Nishman)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className={BUTTON}>Crear marca</button>
        <div className="w-full"><Message {...msg} /></div>
      </form>
      <Message error={error} />
      <Table head={["Color", "Marca", "Productos activos", "Estado", ""]}>
        {data?.brands.map((b) => (
          <tr key={b.id} className={b.active ? "" : "opacity-50"}>
            <td className={TD}>
              <input aria-label={`Color de ${b.name}`} type="color" className="h-8 w-10 cursor-pointer rounded border border-gray-200" value={b.color}
                onChange={(e) => patch(b.id, { color: e.target.value })} />
            </td>
            <td className={`${TD} font-semibold`}>{b.name}</td>
            <td className={TD}>{count(b.id)}</td>
            <td className={TD}>{b.active ? "Activa" : "Desactivada"}</td>
            <td className={`${TD} space-x-3 whitespace-nowrap`}>
              <button className="text-sm text-brand-blue underline" onClick={() => rename(b)}>Renombrar</button>
              <button className="text-sm text-brand-blue underline" onClick={() => patch(b.id, { active: !b.active })}>{b.active ? "Desactivar" : "Activar"}</button>
            </td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-gray-500">Una marca desactivada deja de aparecer en el Dashboard y al crear productos; sus productos y su historial se mantienen.</p>
    </div>
  );
}
