"use client";
import { useEffect, useRef, useState } from "react";
import { CRITERIOS_UI as CRITERIOS } from "./criterios";

type Alumno = { id: string; first_name: string; last_name: string; email: string | null; class_date: string | null; evaluaciones: number; borradores: number; ultimo_promedio: number | null };
type Ev = { id: string; evaluator_name: string; scores: Record<string, number>; total: number; average: number; comments: string | null; created_at: string; emailed_at: string | null; status: "borrador" | "final"; edited_by: string | null };
type Form = { id: string | null; status: "borrador" | "final"; scores: Record<string, number>; comments: string; dirty: boolean };

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
  const [form, setFormState] = useState<Form | null>(null);
  const [guardado, setGuardado] = useState("");
  const formRef = useRef<Form | null>(null);
  const selRef = useRef<Alumno | null>(null);
  const cadena = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<any>(null);
  const ignorarAtras = useRef(false);
  const setForm = (f: Form | null) => { formRef.current = f; setFormState(f); };
  selRef.current = sel;
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [listo, setListo] = useState<Ev | null>(null);
  const [noUnir, setNoUnir] = useState<Record<string, boolean>>({}); // evaluaciones destildadas para unificar
  const [nuevo, setNuevo] = useState<{ first_name: string; last_name: string; email: string } | null>(null);

  async function cargarAlumnos() {
    const r = await api("/api/alumnos/alumnos");
    if (r.status === 401) { setSesion(null); return; }
    setSesion(r.evaluador); setAlumnos(r.alumnos || []);
  }
  useEffect(() => {
    const atras = async () => {
      if (ignorarAtras.current) { ignorarAtras.current = false; return; }
      if (formRef.current) { await guardarYa(); setForm(null); setGuardado(""); if (selRef.current) abrir(selRef.current, true); }
      else if (selRef.current) { setSel(null); setListo(null); setMsg(""); cargarAlumnos(); }
    };
    window.addEventListener("popstate", atras);
    return () => window.removeEventListener("popstate", atras);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { api("/api/alumnos/evaluadores").then((r) => setEv(r.evaluadores || [])); cargarAlumnos(); }, []);

  async function entrar() {
    setBusy(true); setMsg("");
    const r = await api("/api/alumnos/login", { method: "POST", body: JSON.stringify({ evaluator_id: quien!.id, codigo }) });
    setBusy(false);
    if (!r.ok) { setMsg(r.error || "No se pudo entrar."); return; }
    setCodigo(""); await cargarAlumnos();
  }
  async function salir() { await api("/api/alumnos/logout", { method: "POST" }); await guardarYa(); setSesion(null); setQuien(null); setSel(null); setForm(null); setListo(null); }
  async function abrir(a: Alumno, mantener = false) {
    if (!mantener) history.pushState({ n: 1 }, "");
    setSel(a); setForm(null); setMsg(""); if (!mantener) setListo(null); setEmail((e) => (mantener && e ? e : a.email || ""));
    const r = await api(`/api/alumnos/alumnos/${a.id}`); setHist(r.evaluaciones || []);
  }
  // Autoguardado: cada cambio se guarda solo (borrador). Las llamadas van en fila para no crear 2 borradores.
  function guardarYa(): Promise<void> {
    clearTimeout(timer.current);
    cadena.current = cadena.current.then(async () => {
      const f = formRef.current, al = selRef.current;
      if (!f || !al || !f.dirty) return;
      if (!f.id && !Object.keys(f.scores).length && !f.comments.trim()) return;
      const body = JSON.stringify({ student_id: al.id, scores: f.scores, comments: f.comments });
      const r = f.id ? await api(`/api/alumnos/evaluaciones/${f.id}`, { method: "PATCH", body }) : await api("/api/alumnos/evaluaciones", { method: "POST", body });
      if (!r.ok) { setGuardado("⚠ No se pudo guardar. Revisa tu conexión."); return; }
      const cur = formRef.current;
      if (cur) {
        const igual = cur.comments === f.comments && JSON.stringify(cur.scores) === JSON.stringify(f.scores);
        formRef.current = { ...cur, id: r.evaluacion.id, dirty: !igual }; // si cambió mientras guardaba, queda pendiente
        if (!igual) guardarYa();
      }
      setGuardado("Guardado ✔");
    });
    return cadena.current;
  }
  function cambiar(patch: Partial<Form> | ((f: Form) => Partial<Form>)) {
    const act = formRef.current!; // siempre sobre el estado más reciente (toques rápidos)
    const f = { ...act, ...(typeof patch === "function" ? patch(act) : patch), dirty: true };
    setForm(f); setGuardado("Guardando…");
    clearTimeout(timer.current); timer.current = setTimeout(guardarYa, 600);
  }
  async function terminar() {
    const f = formRef.current; if (!f || !sel) return;
    setBusy(true); setMsg("");
    await guardarYa();
    const id = formRef.current?.id;
    const body = JSON.stringify({ student_id: sel.id, scores: f.scores, comments: f.comments, finalizar: true });
    const r = id ? await api(`/api/alumnos/evaluaciones/${id}`, { method: "PATCH", body }) : await api("/api/alumnos/evaluaciones", { method: "POST", body });
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    setForm(null); setGuardado(""); cargarAlumnos();
    ignorarAtras.current = true; history.back(); // quita el paso del formulario del historial
    abrir(sel, true).then(() => setListo(r.evaluacion));
  }
  async function descartar(h: Ev) {
    if (!confirm("¿Descartar este borrador? No se puede deshacer.")) return;
    await api(`/api/alumnos/evaluaciones/${h.id}`, { method: "DELETE" });
    abrir(sel!, true); cargarAlumnos();
  }
  function editar(h: Ev) {
    history.pushState({ n: 2 }, ""); setMsg(""); setListo(null); setGuardado("");
    setForm({ id: h.id, status: h.status, scores: h.scores || {}, comments: h.comments || "", dirty: false });
  }
  async function enviarUnificada(ids: string[]) {
    setBusy(true); setMsg("");
    if (email && email !== sel?.email) {
      const p = await api(`/api/alumnos/alumnos/${sel!.id}`, { method: "PATCH", body: JSON.stringify({ email }) });
      if (!p.ok) { setBusy(false); setMsg(p.error); return; }
      setSel({ ...sel!, email });
    }
    const r = await api("/api/alumnos/unificada/email", { method: "POST", body: JSON.stringify({ student_id: sel!.id, ids }) });
    setBusy(false); setMsg(r.ok ? `Evaluación unificada enviada a ${email} ✔` : r.error);
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
      <button onClick={() => history.back()} className="text-neutral-400 mb-3 py-2 pr-4">← Volver (se guarda solo)</button>
      <h2 className="text-xl font-semibold">{sel.first_name} {sel.last_name}</h2>
      <p className="text-neutral-400 mb-1">Evalúa: <b className="text-white">{sesion}</b></p>
      <p className="text-neutral-500 text-sm mb-4">1 = Deficiente · 3 = Básico · 5 = Bueno · 7 = Excelente</p>
      <div className="grid gap-3">
        {CRITERIOS.map((c) => (
          <div key={c.key} className={`${card} p-4`}>
            <p className="font-semibold text-lg">{c.nombre}</p><p className="text-neutral-400 text-sm mb-3">{c.desc}</p>
            <div className="grid grid-cols-7 gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button key={n} onClick={() => cambiar((f) => ({ scores: { ...f.scores, [c.key]: n } }))}
                  className={`h-14 rounded-xl text-xl font-bold active:scale-95 ${form.scores[c.key] === n ? "bg-[#0F8B8D]" : "bg-neutral-800"}`}>{n}</button>
              ))}
            </div>
          </div>))}
        <div className={`${card} p-4`}>
          <p className="font-semibold mb-2">Comentarios del instructor</p>
          <textarea rows={5} value={form.comments} onChange={(e) => cambiar({ comments: e.target.value })}
            className="w-full rounded-xl bg-black border border-neutral-700 p-3 text-lg" placeholder="Observaciones..." />
        </div>
        <div className={`${card} p-4 text-lg`}>Suma: <b>{suma} / 49</b> · Promedio: <b className="text-[#0F8B8D]">{completo ? (suma / 7).toFixed(2) : "—"} / 7</b></div>
        {msg && <p className="text-red-400">{msg}</p>}
        {guardado && <p className={guardado.startsWith("⚠") ? "text-red-400" : "text-neutral-400 text-sm"}>{guardado}</p>}
        {form.status === "final"
          ? <button onClick={() => history.back()} className={`${btn} bg-[#0F8B8D]`}>Listo, volver</button>
          : <button disabled={!completo || busy} onClick={terminar} className={`${btn} bg-[#0F8B8D]`}>{completo ? "Terminar evaluación" : "Faltan notas para terminar"}</button>}
      </div></div>);
  }

  // 4) Alumno: historial / recién guardada
  if (sel) return shell(<div>
    <button onClick={() => history.back()} className="text-neutral-400 mb-3 py-2 pr-4">← Alumnos</button>
    <h2 className="text-2xl font-semibold mb-4">{sel.first_name} {sel.last_name}</h2>
    <button onClick={() => { history.pushState({ n: 2 }, ""); setForm({ id: null, status: "borrador", scores: {}, comments: "", dirty: false }); setListo(null); setMsg(""); setGuardado(""); }} className={`${btn} bg-[#0F8B8D] w-full mb-5`}>+ Nueva evaluación</button>
    <div className={`${card} p-4 mb-5`}>
      <label className="text-neutral-400 text-sm">Correo del alumno (para enviarle la evaluación)</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alumno@correo.com" className="w-full rounded-xl bg-black border border-neutral-700 p-3 text-lg mt-1" />
    </div>
    {msg && <p className="mb-3 text-[#5ee0e2]">{msg}</p>}
    {listo && <p className="mb-3 text-green-400 font-semibold">Evaluación guardada ✔ — elige abajo: enviar por correo o descargar PDF.</p>}
    {(() => {
      const finales = hist.filter((h) => h.status === "final");
      if (finales.length < 2) return null;
      const elegidas = finales.filter((h) => !noUnir[h.id]);
      const ids = elegidas.map((h) => h.id);
      return (
        <div className={`${card} p-4 mb-5 ring-1 ring-[#0F8B8D]`}>
          <p className="font-semibold mb-1">Unificar evaluaciones</p>
          <p className="text-neutral-400 text-sm mb-3">Un solo informe con las notas de cada evaluador, el promedio y los comentarios por separado.</p>
          <div className="grid gap-2 mb-3">
            {finales.map((h) => (
              <label key={h.id} className="flex items-center gap-3 text-lg py-1">
                <input type="checkbox" className="h-6 w-6 accent-[#0F8B8D]" checked={!noUnir[h.id]} onChange={(e) => setNoUnir({ ...noUnir, [h.id]: !e.target.checked })} />
                <span>{h.evaluator_name} <span className="text-neutral-500 text-sm">· {fecha(h.created_at)} · {Number(h.average).toFixed(2)}</span></span>
              </label>))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button disabled={busy || ids.length < 2 || !email} onClick={() => enviarUnificada(ids)} className={`${btn} bg-[#0F8B8D]`}>Enviar unificada</button>
            {ids.length >= 2
              ? <a href={`/api/alumnos/unificada/pdf?ids=${ids.join(",")}`} className={`${btn} bg-neutral-800 text-center block`}>PDF unificado</a>
              : <span className={`${btn} bg-neutral-800 text-center block opacity-40`}>PDF unificado</span>}
          </div>
          {ids.length < 2 && <p className="text-neutral-500 text-sm mt-2">Marca al menos 2 evaluaciones.</p>}
        </div>);
    })()}
    <h3 className="font-semibold mb-2">Evaluaciones ({hist.length})</h3>
    <div className="grid gap-3">
      {hist.length === 0 && <p className="text-neutral-500">Aún no tiene evaluaciones.</p>}
      {hist.map((h) => (
        <div key={h.id} className={`${card} p-4 ${listo?.id === h.id ? "ring-2 ring-[#0F8B8D]" : ""}`}>
          <div className="flex justify-between"><b>Evaluó: {h.evaluator_name}</b>{h.status === "borrador" ? <span className="text-amber-400 font-semibold">EN CURSO</span> : <span className="text-[#0F8B8D] font-bold text-xl">{Number(h.average).toFixed(2)}</span>}</div>
          <p className="text-neutral-400 text-sm">{fecha(h.created_at)} · {h.status === "borrador" ? `Notas puestas: ${Object.keys(h.scores || {}).length}/7` : `Suma ${h.total}/49`}{h.edited_by ? ` · editada por ${h.edited_by}` : ""}{h.emailed_at ? " · enviado por correo" : ""}</p>
          <div className="grid grid-cols-2 gap-x-4 text-sm mt-2 text-neutral-300">
            {CRITERIOS.map((c) => <div key={c.key} className="flex justify-between"><span>{c.nombre}</span><b>{h.scores?.[c.key] ?? "–"}</b></div>)}
          </div>
          {h.comments && <ul className="mt-2 space-y-1 text-neutral-300">{h.comments.split(/\r?\n/).map((l) => l.replace(/^\s*[-•*–]+\s*/, "").trim()).filter(Boolean).map((l, i) => <li key={i} className="pl-4 -indent-4">• {l}</li>)}</ul>}
          {h.status === "borrador" ? (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button onClick={() => editar(h)} className={`${btn} bg-[#0F8B8D]`}>Continuar</button>
              <button onClick={() => descartar(h)} className={`${btn} bg-neutral-800 text-red-300`}>Descartar</button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 mt-3">
              <button onClick={() => editar(h)} className={`${btn} bg-neutral-800`}>Editar</button>
              <button disabled={busy || !email} onClick={() => enviar(h)} className={`${btn} bg-neutral-800`}>Correo</button>
              <Pdf id={h.id} />
            </div>
          )}
        </div>))}
    </div></div>);

  // 2) Lista de alumnos
  return shell(<div>
    <p className="text-neutral-400 mb-3">Evalúa: <b className="text-white">{sesion}</b>. Elige al alumno:</p>
    <div className="grid gap-3">
      {alumnos.map((a) => (
        <button key={a.id} onClick={() => abrir(a)} className={`${card} p-4 text-left active:scale-[0.98] flex justify-between items-center`}>
          <span><b className="text-lg">{a.first_name} {a.last_name}</b>{a.class_date && <span className="block text-sm text-neutral-500">{a.class_date.split("-").reverse().join("/")}</span>}</span>
          <span className="text-sm text-neutral-400">{a.borradores > 0 && <b className="text-amber-400">en curso · </b>}{a.evaluaciones > 0 ? `${a.evaluaciones} eval. · ${a.ultimo_promedio?.toFixed(2)}` : "sin evaluar"}</span>
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
