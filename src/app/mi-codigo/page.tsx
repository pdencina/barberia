"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

// Página que abre el CELULAR del cliente al escanear el QR «Ver mi código» del tótem: escribe su correo, ve su código personal y puede seguir
// a pagar o avisar su llegada; el tótem avanza solo. Sin cuenta ni contraseña.

interface Resultado { code: string; nombre: string; negocio: { name: string; logo_url: string | null }; cita: { hora: string; servicio: string } }

function MiCodigo() {
  const token = (useSearchParams().get("t") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const [correo, setCorreo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);
  const [hecho, setHecho] = useState<"pagar" | "llegue" | null>(null);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true); setError("");
    try {
      const r = await fetch("/api/totem/vincular/asociar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, email: correo }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error || "No pudimos buscar tu código"); else setRes(d);
    } catch { setError("Sin conexión. Intenta de nuevo."); }
    setCargando(false);
  };

  const elegir = async (accion: "pagar" | "llegue") => {
    setCargando(true); setError("");
    try {
      const r = await fetch("/api/totem/vincular/accion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, accion }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error || "No pudimos continuar"); else setHecho(accion);
    } catch { setError("Sin conexión. Intenta de nuevo."); }
    setCargando(false);
  };

  const boton = "tt-display w-full rounded-2xl bg-white px-6 py-4 text-center text-xl font-semibold text-[#0A0A0A] active:bg-white/80 disabled:opacity-40";
  const secundario = "tt-display w-full rounded-2xl border border-white/20 bg-white/[0.05] px-6 py-4 text-center text-lg font-semibold text-white active:bg-white/10 disabled:opacity-40";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10 text-white">
      {!token ? (
        <p className="text-center text-xl">Escanea el código QR de la pantalla del tótem para ver tu código.</p>
      ) : hecho ? (
        <div className="text-center">
          <svg className="mx-auto mb-6 h-16 w-16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12.5l3 3 6-7" /></svg>
          <h1 className="tt-display text-3xl font-semibold">{hecho === "pagar" ? "Sigue en la pantalla del tótem" : "Ya avisamos tu llegada"}</h1>
          <p className="mt-3 text-lg text-white/65">{hecho === "pagar" ? "En el tótem ya aparece tu cita para pagar." : "El tótem ya recibió tu código y le avisamos a tu profesional."}</p>
          <p className="mt-8 text-sm text-white/40">Tu código: <span className="tt-mono tracking-widest text-white/70">{res?.code}</span></p>
        </div>
      ) : res ? (
        <div>
          {res.negocio.logo_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={res.negocio.logo_url} alt={res.negocio.name} className="mb-5 h-16 w-16 rounded-2xl bg-white object-contain p-1.5" />}
          <p className="tt-mono text-xs uppercase tracking-[0.16em] text-white/50">{res.negocio.name}</p>
          <h1 className="tt-display mt-2 text-3xl font-semibold">Hola{res.nombre ? `, ${res.nombre}` : ""}</h1>
          <p className="mt-1 text-white/65">Tu cita de hoy: {res.cita.hora} · {res.cita.servicio}</p>
          <div className="my-8 rounded-2xl border border-dashed border-white/30 p-6 text-center">
            <p className="text-sm text-white/55">Tu código personal</p>
            <p className="tt-display mt-1 text-6xl font-semibold tracking-[0.25em]">{res.code}</p>
            <p className="mt-2 text-xs text-white/45">Es siempre el mismo. Ya lo recibió el tótem.</p>
          </div>
          {error && <p className="mb-4 rounded-2xl bg-red-500/15 p-4 text-red-300">{error}</p>}
          <div className="space-y-3">
            <button className={boton} disabled={cargando} onClick={() => elegir("pagar")}>Ir a pagar</button>
            <button className={secundario} disabled={cargando} onClick={() => elegir("llegue")}>Avisar que llegué</button>
          </div>
        </div>
      ) : (
        <form onSubmit={buscar}>
          <p className="tt-mono text-xs uppercase tracking-[0.16em] text-white/50">Tótem de autoatención</p>
          <h1 className="tt-display mt-2 text-3xl font-semibold">Ver mi código</h1>
          <p className="mt-3 text-white/65">Escribe el correo con el que reservaste y te mostramos tu código. El tótem lo recibe solo.</p>
          <input value={correo} onChange={(e) => setCorreo(e.target.value.replace(/\s/g, ""))} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="nombre@gmail.com" maxLength={120}
            className="mt-6 w-full rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-4 text-xl outline-none placeholder:text-white/30 focus:border-white/50" />
          {error && <p className="mt-4 rounded-2xl bg-red-500/15 p-4 text-red-300">{error}</p>}
          <button type="submit" className={`${boton} mt-5`} disabled={cargando || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)}>{cargando ? "Buscando…" : "Ver mi código"}</button>
        </form>
      )}
    </main>
  );
}

export default function MiCodigoPage() {
  return <Suspense fallback={null}><MiCodigo /></Suspense>;
}
