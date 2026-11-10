"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

// Totem de autoatencion (pantalla vertical tactil en el local). Pensado para 1080x1920 (o 1920x1080 girada).
// Sin sesion: todo pasa por /api/totem/* con el codigo corto de la cita. Vuelve solo al inicio tras 60 s sin tocarlo.

type Pantalla = "inicio" | "codigo" | "cita" | "sinhora" | "pagar" | "productos" | "info" | "gracias";
interface Cita { id: string; hora: string; servicio: string; profesional: string; cliente: string; llego: boolean; code: string | null }
interface Producto { id: string; name: string; price: number; category: string | null }
interface Info { negocio: { name: string; logo_url: string | null }; productos: Producto[]; info: { title: string; body: string }[] }

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
const NUMEROS = "23456789".split("");
const plata = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

function Totem() {
  const params = useSearchParams();
  const [codigo, setCodigo] = useState<string | null>(null); // null = aún leyendo el equipo; "" = sin configurar
  const [escrito, setEscrito] = useState("");
  const [tocesLogo, setTocesLogo] = useState(0);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [pantalla, setPantalla] = useState<Pantalla>("inicio");
  const [code, setCode] = useState("");
  const [citas, setCitas] = useState<Cita[]>([]);
  const [msg, setMsg] = useState("");
  const [gracias, setGracias] = useState("");
  const [cargando, setCargando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [correo, setCorreo] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [modo, setModo] = useState<"llegue" | "pagar">("llegue");
  const ultimo = useRef(Date.now());

  const inicio = useCallback(() => {
    setPantalla("inicio"); setCode(""); setCitas([]); setMsg(""); setNombre(""); setCelular(""); setCorreo(""); setAcepta(false); setCarrito({}); setGracias(""); setModo("llegue");
  }, []);

  // Reinicio por inactividad (60 s) y reloj de toque.
  useEffect(() => {
    const tocar = () => { ultimo.current = Date.now(); };
    window.addEventListener("pointerdown", tocar);
    const t = setInterval(() => { if (Date.now() - ultimo.current > 60_000) { ultimo.current = Date.now(); inicio(); } }, 5_000);
    return () => { window.removeEventListener("pointerdown", tocar); clearInterval(t); };
  }, [inicio]);

  // Despues de "gracias", vuelve solo.
  useEffect(() => {
    if (pantalla !== "gracias") return;
    const t = setTimeout(inicio, 6_000);
    return () => clearTimeout(t);
  }, [pantalla, inicio]);

  // El código del negocio se escribe UNA vez en el equipo y queda guardado: al encender, abre directo en el inicio.
  useEffect(() => {
    let guardado = "";
    try { guardado = localStorage.getItem("totem_codigo") || ""; } catch { /* sin almacenamiento: se pedirá cada vez */ }
    const url = (params.get("codigo") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    setCodigo(url || guardado);
  }, [params]);

  useEffect(() => {
    if (!codigo) return;
    setError(""); setInfo(null);
    fetch(`/api/totem/info?codigo=${encodeURIComponent(codigo)}`).then(async (r) => {
      if (!r.ok) {
        try { localStorage.removeItem("totem_codigo"); } catch { /* */ }
        setMsg("Ese código no existe o el tótem está apagado. Revísalo en Configuración > Tótem de autoatención.");
        setEscrito("");
        setCodigo("");
        return;
      }
      try { localStorage.setItem("totem_codigo", codigo); } catch { /* */ }
      setMsg("");
      setInfo(await r.json());
    }).catch(() => setError("Sin conexión. Avisa a quien te atiende."));
  }, [codigo]);

  const post = async (ruta: string, cuerpo: Record<string, any>) => {
    const r = await fetch(`/api/totem/${ruta}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo, ...cuerpo }) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, d };
  };

  const buscar = async () => {
    setCargando(true); setMsg("");
    const { ok, d } = await post("buscar", { code });
    setCargando(false);
    if (!ok) { setMsg(d.error || "No pudimos buscar tu cita"); return; }
    if (!d.citas?.length) { setMsg("No encontramos ese código para hoy. Revisa tu correo o avisa a quien te atiende."); return; }
    setCitas(d.citas); setPantalla("cita");
  };

  const llegue = async (c: Cita) => {
    setCargando(true);
    const { ok, d } = await post("llegue", { appointmentId: c.id, code });
    setCargando(false);
    if (!ok) { setMsg(d.error || "No pudimos avisar"); return; }
    setGracias(`¡Gracias ${c.cliente}! Avisamos a ${c.profesional || "tu profesional"}. Toma asiento, te llamamos en un momento.`);
    setPantalla("gracias");
  };

  const pedirPagar = async (c: Cita) => {
    setCargando(true);
    const { ok, d } = await post("solicitud", { tipo: "pago", code });
    setCargando(false);
    if (!ok) { setMsg(d.error || "No pudimos avisar"); return; }
    setGracias("Listo, avisamos para que te cobren. Un momento por favor.");
    setPantalla("gracias");
  };

  const registrar = async () => {
    setCargando(true); setMsg("");
    const { ok, d } = await post("registro", { name: nombre, phone: celular, email: correo, marketingConsent: acepta });
    setCargando(false);
    if (!ok) { setMsg(d.error || "No pudimos registrarte"); return; }
    setGracias("¡Gracias! Ya avisamos que llegaste. Te atenderemos en un momento.");
    setPantalla("gracias");
  };

  const pedirProductos = async () => {
    const productos = Object.entries(carrito).filter(([, n]) => n > 0).map(([id, cantidad]) => ({ id, cantidad }));
    if (!productos.length) return;
    setCargando(true);
    const { ok, d } = await post("solicitud", { tipo: "producto", productos });
    setCargando(false);
    if (!ok) { setMsg(d.error || "No pudimos avisar"); return; }
    setGracias("Listo. Avisamos para que te lo lleven y te lo cobren.");
    setPantalla("gracias");
  };

  const colorFondo = "bg-[#0f1115] text-white";
  const boton = "w-full rounded-3xl bg-white/10 px-8 py-8 text-left text-3xl font-bold active:scale-[0.99] active:bg-white/20";
  const principal = "w-full rounded-3xl bg-emerald-500 px-8 py-7 text-center text-3xl font-extrabold text-[#06130d] active:bg-emerald-400 disabled:opacity-40";
  const volver = (
    <button onClick={inicio} className="mb-8 rounded-2xl bg-white/10 px-6 py-4 text-xl font-semibold">← Volver al inicio</button>
  );

  // Pantalla de configuración del equipo (primera vez o código inválido).
  if (codigo === null) return <main className={`flex min-h-screen items-center justify-center text-2xl ${colorFondo}`}>Cargando…</main>;
  if (codigo === "") {
    const teclas = [...LETRAS, ...NUMEROS];
    return (
      <div className="min-h-screen bg-[#0f1115]">
        <main className={`mx-auto flex min-h-screen w-full max-w-[1080px] flex-col px-12 py-12 ${colorFondo}`}>
          <h1 className="mb-3 text-5xl font-extrabold">Configurar este tótem</h1>
          <p className="mb-8 text-2xl opacity-70">Escribe el código del negocio (7 letras o números). Lo encuentras en re-booking, en Configuración &gt; Tótem de autoatención. Se guarda en este equipo y no se vuelve a pedir.</p>
          <div className="mb-8 flex justify-center gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex h-24 w-20 items-center justify-center rounded-2xl bg-white/10 text-5xl font-extrabold">{escrito[i] || ""}</div>
            ))}
          </div>
          {msg && <p className="mb-6 rounded-2xl bg-red-500/20 p-5 text-2xl text-red-200">{msg}</p>}
          <div className="grid grid-cols-6 gap-3">
            {teclas.map((k) => (
              <button key={k} onClick={() => { setMsg(""); setEscrito((c) => (c.length < 7 ? c + k : c)); }} className="rounded-2xl bg-white/10 py-7 text-4xl font-bold active:bg-white/25">{k}</button>
            ))}
            <button onClick={() => setEscrito((c) => c.slice(0, -1))} className="col-span-2 rounded-2xl bg-white/15 py-7 text-3xl font-bold active:bg-white/25">⌫ Borrar</button>
          </div>
          <div className="mt-8"><button className={principal} disabled={escrito.length !== 7} onClick={() => setCodigo(escrito)}>Abrir tótem</button></div>
        </main>
      </div>
    );
  }
  if (error) return <main className={`flex min-h-screen items-center justify-center p-10 text-center text-3xl ${colorFondo}`}>{error}</main>;
  if (!info) return <main className={`flex min-h-screen items-center justify-center text-2xl ${colorFondo}`}>Cargando…</main>;

  const total = info.productos.reduce((s, p) => s + (carrito[p.id] || 0) * p.price, 0);

  return (
    <div className="min-h-screen bg-[#0f1115]">
    <main className={`mx-auto flex min-h-screen w-full max-w-[1080px] flex-col select-none px-12 py-12 ${colorFondo}`} style={{ touchAction: "manipulation" }}>
      <header className="mb-10 flex items-center gap-5" onClick={() => {
        // Personal del local: 5 toques seguidos al nombre del negocio vuelven a pedir el código.
        const n = tocesLogo + 1; setTocesLogo(n);
        setTimeout(() => setTocesLogo(0), 3000);
        if (n >= 5) { try { localStorage.removeItem("totem_codigo"); } catch { /* */ } setEscrito(""); setCodigo(""); inicio(); }
      }}>
        {info.negocio.logo_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={info.negocio.logo_url} alt="" className="h-20 w-20 rounded-2xl object-cover" />}
        <p className="text-3xl font-bold opacity-90">{info.negocio.name}</p>
      </header>

      {pantalla === "inicio" && (
        <section className="flex flex-1 flex-col justify-center gap-6">
          <h1 className="mb-6 text-6xl font-extrabold leading-tight">Bienvenido 👋<br /><span className="text-4xl font-semibold opacity-80">¿Cómo te podemos ayudar?</span></h1>
          <button className={boton} onClick={() => { setModo("llegue"); setPantalla("codigo"); }}>📅 Tengo hora<span className="mt-1 block text-xl font-normal opacity-70">Avisa que llegaste con tu código</span></button>
          <button className={boton} onClick={() => setPantalla("sinhora")}>✍️ No tengo hora<span className="mt-1 block text-xl font-normal opacity-70">Regístrate y te recibimos</span></button>
          <button className={boton} onClick={() => { setModo("pagar"); setPantalla("codigo"); }}>💳 Quiero pagar<span className="mt-1 block text-xl font-normal opacity-70">Avisa para que te cobren</span></button>
          {info.productos.length > 0 && <button className={boton} onClick={() => setPantalla("productos")}>🥤 Comprar un producto<span className="mt-1 block text-xl font-normal opacity-70">Bebidas, energéticas y más</span></button>}
          {info.info.length > 0 && <button className={boton} onClick={() => setPantalla("info")}>ℹ️ Cursos, promociones y planes<span className="mt-1 block text-xl font-normal opacity-70">Conoce lo que tenemos para ti</span></button>}
        </section>
      )}

      {pantalla === "codigo" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="mb-2 text-5xl font-extrabold">Escribe tu código</h2>
          <p className="mb-8 text-2xl opacity-70">Son 5 letras o números. Lo recibiste en el correo de tu reserva.</p>
          <div className="mb-8 flex justify-center gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex h-28 w-24 items-center justify-center rounded-2xl bg-white/10 text-6xl font-extrabold">{code[i] || ""}</div>
            ))}
          </div>
          {msg && <p className="mb-6 rounded-2xl bg-red-500/20 p-5 text-2xl text-red-200">{msg}</p>}
          <div className="grid grid-cols-6 gap-3">
            {[...LETRAS, ...NUMEROS].map((k) => (
              <button key={k} onClick={() => { setMsg(""); setCode((c) => (c.length < 5 ? c + k : c)); }} className="rounded-2xl bg-white/10 py-7 text-4xl font-bold active:bg-white/25">{k}</button>
            ))}
            <button onClick={() => setCode((c) => c.slice(0, -1))} className="col-span-2 rounded-2xl bg-white/15 py-7 text-3xl font-bold active:bg-white/25">⌫ Borrar</button>
          </div>
          <div className="mt-8">
            <button className={principal} disabled={code.length !== 5 || cargando} onClick={buscar}>{cargando ? "Buscando…" : "Continuar"}</button>
          </div>
        </section>
      )}

      {pantalla === "cita" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="mb-8 text-5xl font-extrabold">{citas.length > 1 ? "Encontramos estas citas" : "Esta es tu cita"}</h2>
          {msg && <p className="mb-6 rounded-2xl bg-red-500/20 p-5 text-2xl text-red-200">{msg}</p>}
          <div className="space-y-6">
            {citas.map((c) => (
              <div key={c.id} className="rounded-3xl bg-white/10 p-8">
                <p className="text-6xl font-extrabold">{c.hora}</p>
                <p className="mt-3 text-3xl font-semibold">{c.servicio}</p>
                <p className="mt-1 text-2xl opacity-70">con {c.profesional || "tu profesional"} · {c.cliente}</p>
                <div className="mt-6">
                  {modo === "pagar"
                    ? <button className={principal} disabled={cargando} onClick={() => pedirPagar(c)}>Quiero pagar ahora</button>
                    : c.llego
                      ? <p className="rounded-2xl bg-emerald-500/20 p-5 text-center text-2xl text-emerald-200">Ya avisamos que llegaste ✓</p>
                      : <button className={principal} disabled={cargando} onClick={() => llegue(c)}>Ya llegué</button>}
                </div>
                {modo === "llegue" && <p className="mt-4 text-center text-xl opacity-60">¿Prefieres pagar ahora? Toca «Volver» y elige «Quiero pagar». También puedes pagar al terminar.</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {pantalla === "sinhora" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="mb-2 text-5xl font-extrabold">Regístrate</h2>
          <p className="mb-8 text-2xl opacity-70">Te recibimos en un momento y te ofrecemos una hora.</p>
          <label className="mb-2 text-2xl font-semibold">Tu nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} className="mb-6 rounded-2xl bg-white/10 px-6 py-6 text-3xl outline-none focus:ring-4 focus:ring-emerald-400" autoComplete="off" />
          <label className="mb-2 text-2xl font-semibold">Tu celular</label>
          <input value={celular} onChange={(e) => setCelular(e.target.value.replace(/[^\d+ ]/g, ""))} inputMode="tel" maxLength={16} placeholder="9 1234 5678" className="mb-6 rounded-2xl bg-white/10 px-6 py-6 text-3xl outline-none placeholder:opacity-40 focus:ring-4 focus:ring-emerald-400" autoComplete="off" />
          <label className="mb-2 text-2xl font-semibold">Tu correo</label>
          <input value={correo} onChange={(e) => setCorreo(e.target.value.replace(/\s/g, ""))} type="email" inputMode="email" maxLength={120} placeholder="nombre@gmail.com" className="mb-6 rounded-2xl bg-white/10 px-6 py-6 text-3xl outline-none placeholder:opacity-40 focus:ring-4 focus:ring-emerald-400" autoComplete="off" autoCapitalize="none" />
          <label className="mb-8 flex items-start gap-4 text-xl opacity-80">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1 h-8 w-8" />
            Acepto recibir promociones del negocio (opcional).
          </label>
          {msg && <p className="mb-6 rounded-2xl bg-red-500/20 p-5 text-2xl text-red-200">{msg}</p>}
          <button className={principal} disabled={cargando || nombre.trim().length < 2 || celular.replace(/\D/g, "").length < 9 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)} onClick={registrar}>{cargando ? "Enviando…" : "Avisar que llegué"}</button>
        </section>
      )}

      {pantalla === "productos" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="mb-2 text-5xl font-extrabold">¿Qué te llevas?</h2>
          <p className="mb-8 text-2xl opacity-70">Elige y avisamos para llevártelo y cobrártelo.</p>
          <div className="space-y-4 pb-6">
            {info.productos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-3xl bg-white/10 p-6">
                <div className="min-w-0"><p className="truncate text-3xl font-bold">{p.name}</p><p className="text-2xl opacity-70">{plata(p.price)}</p></div>
                <div className="flex items-center gap-4">
                  <button className="h-16 w-16 rounded-2xl bg-white/15 text-4xl font-bold active:bg-white/30" onClick={() => setCarrito((c) => ({ ...c, [p.id]: Math.max(0, (c[p.id] || 0) - 1) }))}>−</button>
                  <span className="w-10 text-center text-4xl font-extrabold">{carrito[p.id] || 0}</span>
                  <button className="h-16 w-16 rounded-2xl bg-white/15 text-4xl font-bold active:bg-white/30" onClick={() => setCarrito((c) => ({ ...c, [p.id]: Math.min(10, (c[p.id] || 0) + 1) }))}>+</button>
                </div>
              </div>
            ))}
          </div>
          {msg && <p className="mb-4 rounded-2xl bg-red-500/20 p-5 text-2xl text-red-200">{msg}</p>}
          <div className="sticky bottom-0 mt-auto bg-[#0f1115] pt-4">
            <button className={principal} disabled={total === 0 || cargando} onClick={pedirProductos}>{total > 0 ? `Pedir · ${plata(total)}` : "Elige un producto"}</button>
          </div>
        </section>
      )}

      {pantalla === "info" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="mb-8 text-5xl font-extrabold">Cursos, promociones y planes</h2>
          <div className="space-y-5">
            {info.info.map((s, i) => (
              <div key={i} className="rounded-3xl bg-white/10 p-8">
                <p className="text-3xl font-bold">{s.title}</p>
                <p className="mt-3 whitespace-pre-line text-2xl leading-relaxed opacity-80">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {pantalla === "gracias" && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="mb-8 text-8xl">✅</p>
          <p className="text-5xl font-extrabold leading-snug">{gracias}</p>
          <button onClick={inicio} className="mt-14 rounded-2xl bg-white/10 px-10 py-5 text-2xl font-semibold">Listo</button>
        </section>
      )}
    </main>
    </div>
  );
}

export default function TotemPage() {
  return <Suspense fallback={null}><Totem /></Suspense>;
}
