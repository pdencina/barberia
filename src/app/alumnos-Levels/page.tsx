"use client";
import { useEffect, useState } from "react";
import { CRITERIOS_UI as CRITERIOS } from "./criterios";

type Alumno = { id: string; first_name: string; last_name: string; email: string | null; class_date: string | null; evaluaciones: number; ultimo_promedio: number | null };
type Ev = { id: string; evaluator_name: string; scores: Record<string, number>; total: number; average: number; comments: string | null; created_at: string; emailed_at: string | null };

const card = "rounded-2xl bg-neutral-900 border border-neutral-800";
const btn = "rounded-xl px-5 py-4 text-lg font-semibold active:scale-95 transition disabled:opacity-40";
const fecha = (s: string) => new Date(s).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short" });

async function api(url: string, opts?: RequestInit) {
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json" } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, ...j };
}

export default function Page() {
  const [evaluadores, setEv] = useState<{ id: string; name: string }[]>([]);
  const [quien, setQuien] = useState<{ id: string; name: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [sesion, setSesion] = useState<string | null>(null);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [sel, setSel] = useState<Alumno | null>(null);
  const [hist, setHist] = useState<Ev[]>([]);
  const [form, setForm] = useState<{ scores: Record<string, number>; comments: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [listo, setListo] = useState<Ev | null>(null);
  const [nuevo, setNuevo] = useState<{ first_name: string; last_name: string; email: string } | null>(null);

  async function cargarAlumnos() {
    const r = await api("/api/alumnos/alumnos");
    if (r.status === 401) { setSesion(null); return; }
    setSesion(r.evaluador); setAlumnos(r.alumnos || []);
  }
  useEffect(() => { api("/api/alumnos/evaluadores").then((r) => setEv(r.evaluadores || [])); cargarAlumnos(); }, []);

  async function entrar() {
    setBusy(true); setMsg("");
    const r = await api("/api/alumnos/login", { method: "POST", body: JSON.stringify({ evaluator_id: quien!.id, codigo }) });
    setBusy(false);
    if (!r.ok) { setMsg(r.error || "No se pudo entrar."); return; }
    setCodigo(""); await cargarAlumnos();
  }
  async function salir() { await api("/api/alumnos/logout", { method: "POST" }); setSesion(null); setQuien(null); setSel(null); setForm(null); setListo(null); }
  async function abrir(a: Alumno) {
    setSel(a); setForm(null); setListo(null); setMsg(""); setEmail(a.email || "");
    const r = await api(`/api/alumnos/alumnos/${a.id}`); setHist(r.evaluaciones || []);
  }
  async function guardar() {
    if (!form || !sel) return;
    setBusy(true); setMsg("");
    const r = await api("/api/alumnos/evaluaciones", { method: "POST", body: JSON.stringify({ student_id: sel.id, ...form }) });
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    setListo(r.evaluacion); setForm(null); cargarAlumnos(); abrir(sel).then(() => setListo(r.evaluacion));
  }
  async function enviar(ev: Ev) {
    setBusy(true); setMsg("");
    if (email && email !== sel?.email) {
      const p = await api(`/api/alumnos/alumnos/${sel!.id}`, { method: "PATCH", body: JSON.stringify({ email }) });
      if (!p.ok) { setBusy(false); setMsg(p.error); return; }
      setSel({ ...sel!, email });
    }
    const r = await api(`/api/alumnos/evaluaciones/${ev.id}/email`, { method: "POST" });
    setBusy(false); setMsg(r.ok ? `Enviado a ${email} ✔` : r.error);
    if (r.ok) setHist((h) => h.map((x) => (x.id === ev.id ? { ...x, emailed_at: new Date().toISOString() } : x)));
  }
  async function agregar() {
    if (!nuevo) return;
    const r = await api("/api/alumnos/alumnos", { method: "POST", body: JSON.stringify(nuevo) });
    if (!r.ok) { setMsg(r.error); return; }
    setNuevo(null); setMsg(""); cargarAlumnos();
  }

  const shell = (c: React.ReactNode) => (
    <main className="min-h-screen bg-black text-white p-4 sm:p-8"><div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div><p className="text-[#0F8B8D] text-xs tracking-[0.3em] uppercase">Estudio Levels</p><h1 className="text-2xl font-bold">Evaluación de alumnos</h1></div>
        {sesion && <button onClick={salir} className="text-sm text-neutral-400 underline">Salir ({sesion})</button>}
      </div>{c}</div></main>
  );
  const Pdf = ({ id }: { id: string }) => <a href={`/api/alumnos/evaluaciones/${id}/pdf`} className={`${btn} bg-neutral-800 text-center block`}>Descargar PDF</a>;

  // 1) ¿Quién evalúa? + código
  if (!sesion) return shell(
    <div className={`${card} p-6`}>
      <h2 className="text-xl font-semibold mb-4">¿Quién evalúa?</h2>
      <div className="grid gap-3">
        {evaluadores.map((e) => (
          <button key={e.id} onClick={() => { setQuien(e); setMsg(""); setCodigo(""); }}
            className={`${btn} ${quien?.id === e.id ? "bg-[#0F8B8D]" : "bg-neutral-800"}`}>{e.name}</button>
        ))}
      </div>
      {quien && (<div className="mt-6">
        <label className="block mb-2 text-neutral-400">Código de 6 dígitos de {quien.name}</label>
        <input inputMode="numeric" type="password" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-xl bg-black border border-neutral-700 p-4 text-2xl tracking-[0.5em] text-center" autoFocus />
        <button disabled={busy || codigo.length !== 6} onClick={entrar} className={`${btn} bg-[#0F8B8D] w-full mt-3`}>Entrar</button>
      </div>)}
      {msg && <p className="mt-4 text-red-400">{msg}</p>}
    </div>);

  // 3) Formulario
  if (sel && form) {
    const completo = CRITERIOS.every((c) => form.scores[c.key]);
    const suma = CRITERIOS.reduce((s, c) => s + (form.scores[c.key] || 0), 0);
    return shell(<div>
      <button onClick={() => setForm(null)} className="text-neutral-400 mb-3">← Volver</button>
      <h2 className="text-xl font-semibold">{sel.first_name} {sel.last_name}</h2>
      <p className="text-neutral-400 mb-1">Evalúa: <b className="text-white">{sesion}</b></p>
      <p className="text-neutral-500 text-sm mb-4">1 = Deficiente · 3 = Básico · 5 = Bueno · 7 = Excelente</p>
      <div className="grid gap-3">
        {CRITERIOS.map((c) => (
          <div key={c.key} className={`${card} p-4`}>
            <p className="font-semibold text-lg">{c.nombre}</p><p className="text-neutral-400 text-sm mb-3">{c.desc}</p>
            <div className="grid grid-cols-7 gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button key={n} onClick={() => setForm({ ...form, scores: { ...form.scores, [c.key]: n } })}
                  className={`h-14 rounded-xl text-xl font-bold active:scale-95 ${form.scores[c.key] === n ? "bg-[#0F8B8D]" : "bg-neutral-800"}`}>{n}</button>
              ))}
            </div>
          </div>))}
        <div className={`${card} p-4`}>
          <p className="font-semibold mb-2">Comentarios del instructor</p>
          <textarea rows={5} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })}
            className="w-full rounded-xl bg-black border border-neutral-700 p-3 text-lg" placeholder="Observaciones..." />
        </div>
        <div className={`${card} p-4 text-lg`}>Suma: <b>{suma} / 49</b> · Promedio: <b className="text-[#0F8B8D]">{completo ? (suma / 7).toFixed(2) : "—"} / 7</b></div>
        {msg && <p className="text-red-400">{msg}</p>}
        <button disabled={!completo || busy} onClick={guardar} className={`${btn} bg-[#0F8B8D]`}>Guardar evaluación</button>
      </div></div>);
  }

  // 4) Alumno: historial / recién guardada
  if (sel) return shell(<div>
    <button onClick={() => { setSel(null); setListo(null); setMsg(""); }} className="text-neutral-400 mb-3">← Alumnos</button>
    <h2 className="text-2xl font-semibold mb-4">{sel.first_name} {sel.last_name}</h2>
    <button onClick={() => { setForm({ scores: {}, comments: "" }); setListo(null); setMsg(""); }} className={`${btn} bg-[#0F8B8D] w-full mb-5`}>+ Nueva evaluación</button>
    <div className={`${card} p-4 mb-5`}>
      <label className="text-neutral-400 text-sm">Correo del alumno (para enviarle la evaluación)</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alumno@correo.com" className="w-full rounded-xl bg-black border border-neutral-700 p-3 text-lg mt-1" />
    </div>
    {msg && <p className="mb-3 text-[#5ee0e2]">{msg}</p>}
    {listo && <p className="mb-3 text-green-400 font-semibold">Evaluación guardada ✔ — elige abajo: enviar por correo o descargar PDF.</p>}
    <h3 className="font-semibold mb-2">Evaluaciones ({hist.length})</h3>
    <div className="grid gap-3">
      {hist.length === 0 && <p className="text-neutral-500">Aún no tiene evaluaciones.</p>}
      {hist.map((h) => (
        <div key={h.id} className={`${card} p-4 ${listo?.id === h.id ? "ring-2 ring-[#0F8B8D]" : ""}`}>
          <div className="flex justify-between"><b>Evaluó: {h.evaluator_name}</b><span className="text-[#0F8B8D] font-bold text-xl">{Number(h.average).toFixed(2)}</span></div>
          <p className="text-neutral-400 text-sm">{fecha(h.created_at)} · Suma {h.total}/49{h.emailed_at ? " · enviado por correo" : ""}</p>
          <div className="grid grid-cols-2 gap-x-4 text-sm mt-2 text-neutral-300">
            {CRITERIOS.map((c) => <div key={c.key} className="flex justify-between"><span>{c.nombre}</span><b>{h.scores[c.key]}</b></div>)}
          </div>
          {h.comments && <p className="mt-2 text-neutral-300 whitespace-pre-wrap">{h.comments}</p>}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <button disabled={busy || !email} onClick={() => enviar(h)} className={`${btn} bg-neutral-800`}>Enviar por correo</button>
            <Pdf id={h.id} />
          </div>
        </div>))}
    </div></div>);

  // 2) Lista de alumnos
  return shell(<div>
    <p className="text-neutral-400 mb-3">Evalúa: <b className="text-white">{sesion}</b>. Elige al alumno:</p>
    <div className="grid gap-3">
      {alumnos.map((a) => (
        <button key={a.id} onClick={() => abrir(a)} className={`${card} p-4 text-left active:scale-[0.98] flex justify-between items-center`}>
          <span><b className="text-lg">{a.first_name} {a.last_name}</b>{a.class_date && <span className="block text-sm text-neutral-500">{a.class_date.split("-").reverse().join("/")}</span>}</span>
          <span className="text-sm text-neutral-400">{a.evaluaciones > 0 ? `${a.evaluaciones} eval. · ${a.ultimo_promedio?.toFixed(2)}` : "sin evaluar"}</span>
        </button>))}
    </div>
    {nuevo ? (<div className={`${card} p-4 mt-4 grid gap-2`}>
      {(["first_name", "last_name", "email"] as const).map((k) => (
        <input key={k} value={nuevo[k]} onChange={(e) => setNuevo({ ...nuevo, [k]: e.target.value })} placeholder={k === "first_name" ? "Nombre" : k === "last_name" ? "Apellido" : "Correo (opcional)"} className="rounded-xl bg-black border border-neutral-700 p-3 text-lg" />))}
      {msg && <p className="text-red-400">{msg}</p>}
      <button onClick={agregar} className={`${btn} bg-[#0F8B8D]`}>Agregar</button>
    </div>) : <button onClick={() => setNuevo({ first_name: "", last_name: "", email: "" })} className="mt-4 text-neutral-400 underline">+ Agregar alumno</button>}
  </div>);
}
