"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCan } from "@/components/empresa/shell";
import { api, BUTTON, BUTTON_LIGHT, CARD, errorText, INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";
import { RESULT_LABEL, type ActivityResult } from "@/lib/empresas/cartera";

const fecha = (ms: number | string) => new Date(ms).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
const mañana = () => new Date(Date.now() + 86400e3 - 3 * 3600e3).toISOString().slice(0, 10);

// Cola obligatoria: el vendedor resuelve el cliente que toca antes de pasar al siguiente.
function MiCola({ sellerId }: { sellerId?: string }) {
  const { data, error, reload } = useApi<any>(sellerId ? `cartera?sellerId=${sellerId}` : "cartera");
  const [notes, setNotes] = useState("");
  const [callbackOn, setCallbackOn] = useState(mañana());
  const [skipReason, setSkipReason] = useState("");
  const [mode, setMode] = useState<"" | "callback" | "skipped">("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, setBusy] = useState(false);
  const current = data?.current;

  const save = async (result: ActivityResult) => {
    setBusy(true);
    setMsg({});
    try {
      await api("gestiones", { customerId: current.customerId, result, notes, callbackOn: result === "callback" ? callbackOn : undefined, skipReason: result === "skipped" ? skipReason : undefined });
      setMsg({ ok: `Anotado: ${RESULT_LABEL[result]}.` });
      setNotes(""); setSkipReason(""); setMode("");
      reload();
    } catch (e) {
      setMsg({ error: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Message error={error} />;
  if (!data) return <p className="text-sm text-gray-500">Cargando...</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Cartera: <b>{data.portfolio}</b> clientes · Pendientes hoy: <b>{data.queue.length}</b>
      </p>
      <Message {...msg} />
      {!current ? (
        <div className={CARD}><p className="text-sm text-brand-dark">No tienes clientes pendientes. ¡Buen trabajo!</p></div>
      ) : (
        <div className={`${CARD} space-y-3`}>
          <div>
            <p className="text-xs uppercase text-gray-500">Te toca llamar a</p>
            <p className="text-lg font-bold text-brand-dark">{current.customer?.name || current.name}</p>
            <p className="text-sm text-gray-600">
              {[current.customer?.contact_name, current.customer?.city].filter(Boolean).join(" · ") || "Sin contacto registrado"}
            </p>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              {current.customer?.phone && <a className="font-semibold text-brand-blue underline" href={`tel:${current.customer.phone}`}>{current.customer.phone}</a>}
              {current.customer?.email && <a className="text-brand-blue underline" href={`mailto:${current.customer.email}`}>{current.customer.email}</a>}
            </div>
          </div>
          {current.history?.length > 0 && (
            <div className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
              <p className="mb-1 font-semibold">Últimas gestiones</p>
              {current.history.map((h: any, i: number) => (
                <p key={i}>{fecha(h.created_at)}: {RESULT_LABEL[h.result as ActivityResult]}{h.callback_on ? ` (para el ${h.callback_on})` : ""}{h.notes ? ` · ${h.notes}` : ""}</p>
              ))}
            </div>
          )}
          <textarea aria-label="Notas" className={`${INPUT} h-20 py-2`} placeholder="Notas del llamado (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} className={BUTTON} onClick={() => save("sold")}>Vendió</button>
            <button disabled={busy} className={BUTTON_LIGHT} onClick={() => save("no_answer")}>No contestó</button>
            <button disabled={busy} className={BUTTON_LIGHT} onClick={() => setMode(mode === "callback" ? "" : "callback")}>Volver a llamar</button>
            <button disabled={busy} className={BUTTON_LIGHT} onClick={() => save("not_interested")}>Sin interés</button>
            <button disabled={busy} className={BUTTON_LIGHT} onClick={() => setMode(mode === "skipped" ? "" : "skipped")}>Saltar</button>
            <Link href="/empresa/pedidos" className={`${BUTTON_LIGHT} inline-flex items-center`}>Tomar pedido</Link>
          </div>
          {mode === "callback" && (
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label="Fecha para volver a llamar" type="date" className={`${INPUT} w-auto`} value={callbackOn} min={mañana()} onChange={(e) => setCallbackOn(e.target.value)} />
              <button disabled={busy} className={BUTTON} onClick={() => save("callback")}>Guardar</button>
            </div>
          )}
          {mode === "skipped" && (
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label="Motivo" className={`${INPUT} min-w-[240px] flex-1`} placeholder="¿Por qué lo saltas? (aparece en el reporte)" value={skipReason} onChange={(e) => setSkipReason(e.target.value)} />
              <button disabled={busy || !skipReason.trim()} className={BUTTON} onClick={() => save("skipped")}>Saltar</button>
            </div>
          )}
          <p className="text-xs text-gray-500">Si vendió, anota “Vendió” y toma el pedido en Pedidos. Un pedido nuevo también cuenta como venta.</p>
        </div>
      )}
      {data.queue.length > 1 && (
        <Table head={["Después", "Desde", "Última gestión"]}>
          {data.queue.slice(1, 30).map((q: any) => (
            <tr key={q.customerId}>
              <td className={TD}>{q.name}</td>
              <td className={TD}>{fecha(q.dueAt)}</td>
              <td className={TD}>{q.lastResult ? RESULT_LABEL[q.lastResult as ActivityResult] : "Nunca"}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

// Vista del dueño: resumen por vendedor, asignación de clientes y la cola de cada uno.
function Cartera() {
  const { data, error, reload } = useApi<any>("cartera");
  const [filter, setFilter] = useState("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const [viewSeller, setViewSeller] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const now = Date.now();

  const sellers: any[] = data?.sellers || [];
  const nameOf = (id: string | null) => (id ? sellers.find((s) => s.userId === id)?.name || "Otro" : "Sin vendedor");
  const rows = useMemo(() => {
    const list: any[] = data?.customers || [];
    if (filter === "todos") return list;
    if (filter === "sin") return list.filter((c) => !c.sellerId);
    return list.filter((c) => c.sellerId === filter);
  }, [data, filter]);

  const assign = async () => {
    setMsg({});
    try {
      const r = await api("cartera", { customerIds: Array.from(selected), sellerId: target === "ninguno" ? null : target });
      setMsg({ ok: `${r.updated} clientes actualizados.` });
      setSelected(new Set());
      reload();
    } catch (e) {
      setMsg({ error: errorText(e) });
    }
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  if (error) return <Message error={error} />;
  if (!data) return <p className="text-sm text-gray-500">Cargando...</p>;
  return (
    <div className="space-y-4">
      <Table head={["Vendedor", "Cartera", "Pendientes hoy", ""]}>
        {sellers.map((s) => (
          <tr key={s.userId}>
            <td className={TD}>{s.name}</td>
            <td className={TD}>{s.portfolio}</td>
            <td className={TD}>{s.pending}</td>
            <td className={TD}><button className="text-sm text-brand-blue underline" onClick={() => setViewSeller(viewSeller === s.userId ? "" : s.userId)}>{viewSeller === s.userId ? "Ocultar cola" : "Ver su cola"}</button></td>
          </tr>
        ))}
        <tr><td className={TD}>Sin vendedor</td><td className={TD}>{data.unassigned}</td><td className={TD}>-</td><td className={TD} /></tr>
      </Table>
      {viewSeller && (
        <div className={CARD}>
          <p className="mb-2 text-sm font-semibold text-brand-dark">Cola de {nameOf(viewSeller)}. Si el vendedor quedó trabado, puedes anotar tú la gestión.</p>
          <MiCola sellerId={viewSeller} />
        </div>
      )}
      <div className={`${CARD} flex flex-wrap items-center gap-2`}>
        <select aria-label="Filtrar" className={`${INPUT} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="todos">Todos los clientes</option>
          <option value="sin">Sin vendedor</option>
          {sellers.map((s) => <option key={s.userId} value={s.userId}>De {s.name}</option>)}
        </select>
        <span className="text-sm text-gray-500">{selected.size} seleccionados</span>
        <select aria-label="Asignar a" className={`${INPUT} w-auto`} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Asignar a...</option>
          {sellers.map((s) => <option key={s.userId} value={s.userId}>{s.name}</option>)}
          <option value="ninguno">Quitar vendedor</option>
        </select>
        <button className={BUTTON} disabled={!selected.size || !target} onClick={assign}>Asignar</button>
        <Message {...msg} />
      </div>
      <Table head={["", "Cliente", "Vendedor", "Le toca"]}>
        {rows.map((c) => (
          <tr key={c.customerId}>
            <td className={TD}><input aria-label={`Elegir ${c.name}`} type="checkbox" checked={selected.has(c.customerId)} onChange={() => toggle(c.customerId)} /></td>
            <td className={TD}>{c.name}</td>
            <td className={TD}>{nameOf(c.sellerId)}</td>
            <td className={TD}>{c.dueAt <= now ? <span className="font-semibold text-red-700">Ahora</span> : fecha(c.dueAt)}</td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-gray-500">
        Cada cliente se llama cada {data.settings.contactEveryDays} días. “No contestó” vuelve a la cola en {data.settings.noAnswerRetryDays} días, hasta {data.settings.maxNoAnswerAttempts} intentos. Se cambia en Configuración.
      </p>
    </div>
  );
}

export default function CarteraPage() {
  const can = useCan();
  const owner = can("cartera.ver_todas");
  return (
    <div className="space-y-4">
      <Title>{owner ? "Cartera de vendedores" : "Mi cola de llamados"}</Title>
      {owner ? <Cartera /> : <MiCola />}
    </div>
  );
}
