"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Qr } from "@/components/totem/qr";

// Totem de autoatencion (pantalla vertical tactil en el local). Pensado para 1080x1920 (o 1920x1080 girada).
// Sin sesion: todo pasa por /api/totem/* con el codigo corto de la cita. Vuelve solo al inicio tras 60 s sin tocarlo.

type Pantalla = "inicio" | "codigo" | "cita" | "pagoqr" | "pagoterm" | "nohora" | "reservar" | "pagar" | "productos" | "info" | "gracias";
interface Cita { id: string; fecha?: string | null; hora: string; servicio: string; profesional: string; cliente: string; llego: boolean; code: string | null }
interface Producto { id: string; name: string; price: number; category: string | null }
interface Info { negocio: { name: string; logo_url: string | null }; reserva: string | null; reservaPantalla: string | null; productos: Producto[]; pagoQr?: boolean; pagoTerminal?: boolean; tarjetaElige?: boolean; info: { title: string; body: string }[] }

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
const NUMEROS = "23456789".split("");
const plata = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

// Fila de opción: número en mono, título, detalle y flecha. Sin íconos ni emojis.
function Opcion({ n, t, d }: { n?: string; t: string; d: string }) {
  return (
    <>
      <span className="flex items-center gap-6">
        {n && <span className="tt-mono text-lg text-white/35">{n}</span>}
        <span><span className="block">{t}</span><span className="mt-1 block font-[family-name:var(--font-body)] text-xl font-normal text-white/60">{d}</span></span>
      </span>
      <span aria-hidden className="text-3xl text-white/35">→</span>
    </>
  );
}

// Elementos gráficos y flotantes del sitio de re-booking: tarjetas y círculos que flotan despacio, en blanco con baja opacidad sobre negro.
function Fondo() {
  const tarjeta = "absolute rounded-2xl border border-white/[0.10] bg-[#111312] shadow-[0_26px_46px_-28px_rgba(0,0,0,0.9)]";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <style>{`
        @keyframes ttFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        @keyframes ttDrift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(14px,-20px); } }
        @keyframes ttPulse { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.28); } 70% { box-shadow: 0 0 0 22px rgba(255,255,255,0); } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); } }
      `}</style>
      <div className="absolute -left-40 -top-40 h-[640px] w-[640px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.07), transparent)" }} />
      <div className="absolute -bottom-48 -right-40 h-[640px] w-[640px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.05), transparent)" }} />
      {/* tarjetas flotantes (como las del landing), sin texto */}
      <div className={`${tarjeta} right-[-30px] top-[6%] h-28 w-60 opacity-90`} style={{ animation: "ttFloat 7s ease-in-out infinite" }}>
        <span className="absolute left-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/80"><svg className="h-5 w-5 text-[#0A0A0A]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12.5l4 4 8-9" /></svg></span>
        <span className="absolute left-[68px] top-6 h-2.5 w-24 rounded-full bg-white/25" /><span className="absolute left-[68px] top-11 h-2.5 w-16 rounded-full bg-white/15" />
        <span className="absolute bottom-4 left-5 h-2 w-40 rounded-full bg-white/10" />
      </div>
      <div className={`${tarjeta} bottom-[5%] left-[-20px] h-24 w-56 opacity-85`} style={{ animation: "ttFloat 8.4s ease-in-out 1s infinite" }}>
        <span className="absolute left-5 top-5 h-9 w-9 rounded-xl bg-white/15" />
        <span className="absolute left-[68px] top-6 h-2.5 w-20 rounded-full bg-white/25" /><span className="absolute left-[68px] top-11 h-2.5 w-28 rounded-full bg-white/15" />
      </div>
      <div className={`${tarjeta} right-[-10px] bottom-[6%] h-20 w-44 opacity-80`} style={{ animation: "ttFloat 9s ease-in-out 0.5s infinite" }}>
        <span className="absolute left-4 top-4 h-2.5 w-12 rounded-full bg-white/25" />
        <span className="absolute bottom-4 left-4 flex items-end gap-1.5"><i className="block h-4 w-2.5 rounded-sm bg-white/20" /><i className="block h-7 w-2.5 rounded-sm bg-white/30" /><i className="block h-5 w-2.5 rounded-sm bg-white/20" /><i className="block h-9 w-2.5 rounded-sm bg-white/40" /></span>
      </div>
      {/* círculos y puntos */}
      <span className="absolute right-[22%] top-[34%] h-24 w-24 rounded-full border border-white/[0.12]" style={{ animation: "ttDrift 11s ease-in-out infinite" }} />
      <span className="absolute left-[8%] top-[18%] h-10 w-10 rounded-full border border-white/[0.18]" style={{ animation: "ttDrift 9s ease-in-out 1s infinite" }} />
      <span className="absolute bottom-[30%] right-[8%] h-3.5 w-3.5 rounded-full bg-white/40" style={{ animation: "ttDrift 8s ease-in-out 0.4s infinite, ttPulse 2.8s infinite" }} />
      <span className="absolute left-[30%] top-[6%] h-2.5 w-2.5 rounded-full bg-white/30" style={{ animation: "ttDrift 10s ease-in-out 2s infinite" }} />
    </div>
  );
}

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
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [modo, setModo] = useState<"llegue" | "pagar">("llegue");
  const [pagoQr, setPagoQr] = useState<{ id: string; url: string; monto: number; abono: number } | null>(null);
  const [pagoTerm, setPagoTerm] = useState<{ id: string; monto: number; abono: number } | null>(null);
  const ultimo = useRef(Date.now());
  const pantallaRef = useRef<Pantalla>("inicio");
  useEffect(() => { pantallaRef.current = pantalla; }, [pantalla]);

  const inicio = useCallback(() => {
    setPantalla("inicio"); setCode(""); setCitas([]); setMsg(""); setCarrito({}); setGracias(""); setModo("llegue"); setPagoQr(null); setPagoTerm(null);
  }, []);

  // Reinicio por inactividad (60 s) y reloj de toque.
  useEffect(() => {
    const tocar = () => { ultimo.current = Date.now(); };
    window.addEventListener("pointerdown", tocar);
    const t = setInterval(() => { if (Date.now() - ultimo.current > (pantallaRef.current === "reservar" ? 300_000 : (pantallaRef.current === "pagoqr" || pantallaRef.current === "pagoterm") ? 240_000 : 60_000)) { ultimo.current = Date.now(); inicio(); } }, 5_000);
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
    setGracias(`¡Gracias ${c.cliente}! Ya le avisamos a ${c.profesional || "tu profesional"} que llegaste. Toma asiento, en un momento te atienden.`);
    setPantalla("gracias");
  };

  const pedirPagar = async (c: Cita) => {
    setCargando(true);
    const { ok, d } = await post("solicitud", { tipo: "pago", code });
    setCargando(false);
    if (!ok) { setMsg(d.error || "No pudimos avisar"); return; }
    setGracias("Listo, ya le avisamos al equipo que quieres pagar. En un momento te atienden en caja.");
    setPantalla("gracias");
  };

  const crearPagoQr = async (c: Cita) => {
    setCargando(true); setMsg("");
    const { ok, d } = await post("pago-qr", { appointmentId: c.id, code });
    setCargando(false);
    if (!ok) { setMsg(d.error || "No pudimos crear el pago"); return; }
    setPagoQr({ id: d.id, url: d.url, monto: d.monto, abono: d.abono });
    setPantalla("pagoqr");
  };

  const crearPagoTerminal = async (c: Cita, tarjeta: "debito" | "credito") => {
    setCargando(true); setMsg("");
    const { ok, d } = await post("pago-terminal", { appointmentId: c.id, code, tarjeta });
    setCargando(false);
    if (!ok) { setMsg(d.error || "No pudimos enviar el cobro a la máquina"); return; }
    setPagoTerm({ id: d.id, monto: d.monto, abono: d.abono });
    setPantalla("pagoterm");
  };

  const cancelarPagoTerminal = async () => {
    if (pagoTerm) { try { await post("pago-cancelar", { id: pagoTerm.id }); } catch { /* se sigue igual */ } }
    setPagoTerm(null); setMsg(""); setPantalla("cita");
  };

  // Mientras la máquina espera la tarjeta, se pregunta cada 3 s cómo va el cobro.
  useEffect(() => {
    if (pantalla !== "pagoterm" || !pagoTerm || !codigo) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/totem/pago-estado?codigo=${encodeURIComponent(codigo)}&id=${pagoTerm.id}`);
        const d = await r.json();
        if (d.estado === "paid") { setGracias("¡Pago recibido! Gracias. Ya avisamos a tu profesional."); setPantalla("gracias"); }
        else if (d.estado === "failed") { setPagoTerm(null); setMsg("La máquina no aprobó el pago. Puedes intentar de nuevo o pagar con el equipo."); setPantalla("cita"); }
        else if (d.estado === "cancelled") { setPagoTerm(null); setMsg("El cobro se canceló."); setPantalla("cita"); }
        else if (d.estado === "expired") { setPagoTerm(null); setGracias("Se agotó el tiempo de espera. Si la máquina alcanzó a cobrarte, avisa a quien te atiende: lo verificaremos."); setPantalla("gracias"); }
      } catch { /* se reintenta */ }
    }, 3000);
    return () => clearInterval(t);
  }, [pantalla, pagoTerm, codigo]);

  // Mientras se muestra el QR, se pregunta cada 3 s si ya se pagó.
  useEffect(() => {
    if (pantalla !== "pagoqr" || !pagoQr || !codigo) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/totem/pago-estado?codigo=${encodeURIComponent(codigo)}&id=${pagoQr.id}`);
        const d = await r.json();
        if (d.estado === "paid") { setGracias("¡Pago recibido! Gracias. Ya avisamos a tu profesional."); setPantalla("gracias"); }
      } catch { /* se reintenta */ }
    }, 3000);
    return () => clearInterval(t);
  }, [pantalla, pagoQr, codigo]);

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

  const colorFondo = "bg-[#0A0A0A] text-white";
  const boton = "tt-display flex w-full items-center justify-between gap-6 rounded-2xl border border-white/[0.12] bg-white/[0.04] px-8 py-7 text-left text-3xl font-semibold transition active:scale-[0.995] active:bg-white/[0.08]";
  const principal = "tt-display w-full rounded-2xl bg-white px-8 py-7 text-center text-3xl font-semibold text-[#0A0A0A] transition active:bg-white/80 disabled:opacity-40";
  const volver = (
    <button onClick={inicio} className="tt-mono mb-8 self-start rounded-xl border border-white/[0.12] px-5 py-3 text-base uppercase tracking-[0.12em] text-white/60">← Inicio</button>
  );

  // Pantalla de configuración del equipo (primera vez o código inválido).
  if (codigo === null) return <main className={`flex min-h-screen items-center justify-center text-2xl ${colorFondo}`}>Cargando…</main>;
  if (codigo === "") {
    const teclas = [...LETRAS, ...NUMEROS];
    return (
      <div className="relative min-h-screen bg-[#0A0A0A]">
        <Fondo />
        <main className={`relative z-10 mx-auto flex min-h-screen w-full max-w-[1080px] flex-col px-12 py-12 text-white`}>
          <h1 className="tt-display mb-3 text-5xl font-semibold">Configurar este tótem</h1>
          <p className="mb-8 text-2xl opacity-70">Escribe el código del negocio (7 letras o números). Lo encuentras en re-booking, en Configuración &gt; Tótem de autoatención. Se guarda en este equipo y no se vuelve a pedir.</p>
          <div className="mb-8 flex justify-center gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex h-24 w-20 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] text-5xl font-semibold">{escrito[i] || ""}</div>
            ))}
          </div>
          {msg && <p className="mb-6 rounded-2xl bg-red-500/15 p-5 text-2xl text-red-300">{msg}</p>}
          <div className="grid grid-cols-6 gap-3">
            {teclas.map((k) => (
              <button key={k} onClick={() => { setMsg(""); setEscrito((c) => (c.length < 7 ? c + k : c)); }} className="rounded-xl border border-white/[0.12] bg-white/[0.04] py-7 text-4xl font-bold active:bg-white/15">{k}</button>
            ))}
            <button onClick={() => setEscrito((c) => c.slice(0, -1))} className="col-span-2 rounded-xl border border-white/20 bg-white/[0.08] py-7 text-3xl font-bold active:bg-white/15">Borrar</button>
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
    <div className="relative min-h-screen bg-[#0A0A0A]">
    <Fondo />
    <main className={`relative z-10 mx-auto flex min-h-screen w-full max-w-[1080px] flex-col select-none px-12 py-12 ${colorFondo.replace("bg-[#0A0A0A] ", "")}`} style={{ touchAction: "manipulation" }}>
      <header className="mb-8 flex items-center gap-6" onClick={() => {
        // Personal del local: 5 toques seguidos al nombre del negocio vuelven a pedir el código.
        const n = tocesLogo + 1; setTocesLogo(n);
        setTimeout(() => setTocesLogo(0), 3000);
        if (n >= 5) { try { localStorage.removeItem("totem_codigo"); } catch { /* */ } setEscrito(""); setCodigo(""); inicio(); }
      }}>
        {info.negocio.logo_url && (
          // El logo del negocio va sobre un cuadro claro: muchos logos son oscuros y se perderían sobre el negro.
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={info.negocio.logo_url} alt={info.negocio.name} className="h-24 w-24 rounded-3xl bg-white object-contain p-2" />
        )}
        <p className="tt-mono text-lg uppercase tracking-[0.16em] text-white/60">{info.negocio.name}</p>
      </header>

      {pantalla === "inicio" && (
        <section className="flex flex-1 flex-col justify-center gap-6">
          <p className="tt-mono mb-4 text-lg uppercase tracking-[0.16em] text-white/60">Autoatención</p>
          <h1 className="tt-display mb-10 text-7xl font-semibold leading-[1.02] tracking-tight">Bienvenido.<br /><span className="text-4xl font-medium text-white/60">¿Cómo te podemos ayudar?</span></h1>
          <button className={boton} onClick={() => { setModo("llegue"); setPantalla("codigo"); }}><Opcion n="01" t="Tengo hora" d="Avisa que llegaste con tu código" /></button>
          <button className={boton} onClick={() => setPantalla("nohora")}><Opcion n="02" t="No tengo hora" d="Reserva aquí o desde tu celular" /></button>
          <button className={boton} onClick={() => { setModo("pagar"); setPantalla("codigo"); }}><Opcion n="03" t="Quiero pagar" d="Paga desde tu celular o con el equipo" /></button>
          {info.productos.length > 0 && <button className={boton} onClick={() => setPantalla("productos")}><Opcion n="04" t="Comprar un producto" d="Bebidas, energéticas y más" /></button>}
          {info.info.length > 0 && <button className={boton} onClick={() => setPantalla("info")}><Opcion n="05" t="Cursos, promociones y planes" d="Conoce lo que tenemos para ti" /></button>}
        </section>
      )}

      {pantalla === "codigo" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="tt-display mb-2 text-5xl font-semibold">Escribe tu código</h2>
          <p className="mb-8 text-2xl opacity-70">Son 5 letras o números. Lo recibiste en el correo de tu reserva.</p>
          <div className="mb-8 flex justify-center gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex h-28 w-24 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] text-6xl font-semibold">{code[i] || ""}</div>
            ))}
          </div>
          {msg && <p className="mb-6 rounded-2xl bg-red-500/15 p-5 text-2xl text-red-300">{msg}</p>}
          <div className="grid grid-cols-6 gap-3">
            {[...LETRAS, ...NUMEROS].map((k) => (
              <button key={k} onClick={() => { setMsg(""); setCode((c) => (c.length < 5 ? c + k : c)); }} className="rounded-xl border border-white/[0.12] bg-white/[0.04] py-7 text-4xl font-bold active:bg-white/15">{k}</button>
            ))}
            <button onClick={() => setCode((c) => c.slice(0, -1))} className="col-span-2 rounded-xl border border-white/20 bg-white/[0.08] py-7 text-3xl font-bold active:bg-white/15">Borrar</button>
          </div>
          <div className="mt-8">
            <button className={principal} disabled={code.length !== 5 || cargando} onClick={buscar}>{cargando ? "Buscando…" : "Continuar"}</button>
          </div>
        </section>
      )}

      {pantalla === "cita" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="tt-display mb-8 text-5xl font-semibold">{citas.length > 1 ? "Encontramos estas citas" : "Esta es tu cita"}</h2>
          {msg && <p className="mb-6 rounded-2xl bg-red-500/15 p-5 text-2xl text-red-300">{msg}</p>}
          <div className="space-y-6">
            {citas.map((c) => (
              <div key={c.id} className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-8">
                {c.fecha && <p className="mb-2 text-2xl font-semibold text-white">{new Date(`${c.fecha}T12:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })} (modo pruebas)</p>}
                <p className="text-6xl font-semibold">{c.hora}</p>
                <p className="mt-3 text-3xl font-semibold">{c.servicio}</p>
                <p className="mt-1 text-2xl opacity-70">con {c.profesional || "tu profesional"} · {c.cliente}</p>
                <div className="mt-6">
                  {modo === "pagar"
                    ? <div className="space-y-4">
                        {info.pagoTerminal && (info.tarjetaElige ? (
                          <div className="grid grid-cols-2 gap-4">
                            <button className={principal} disabled={cargando} onClick={() => crearPagoTerminal(c, "debito")}>{cargando ? "Enviando…" : "Pagar con débito"}</button>
                            <button className={principal} disabled={cargando} onClick={() => crearPagoTerminal(c, "credito")}>{cargando ? "Enviando…" : "Pagar con crédito"}</button>
                          </div>
                        ) : <button className={principal} disabled={cargando} onClick={() => crearPagoTerminal(c, "debito")}>{cargando ? "Enviando a la máquina…" : "Pagar con tarjeta aquí"}</button>)}
                        {info.pagoQr && <button className={info.pagoTerminal ? "w-full rounded-2xl border border-white/[0.12] bg-white/[0.04] px-8 py-6 text-center text-2xl font-bold" : principal} disabled={cargando} onClick={() => crearPagoQr(c)}>{cargando ? "Creando QR…" : "Pagar desde mi celular (QR)"}</button>}
                        <button className={(info.pagoQr || info.pagoTerminal) ? "w-full rounded-2xl border border-white/[0.12] bg-white/[0.04] px-8 py-6 text-center text-2xl font-bold" : principal} disabled={cargando} onClick={() => pedirPagar(c)}>{(info.pagoQr || info.pagoTerminal) ? "Prefiero pagar en caja (avisamos al equipo)" : "Quiero pagar en caja (avisamos al equipo)"}</button>
                      </div>
                    : c.llego
                      ? <p className="rounded-2xl bg-white/10 p-5 text-center text-2xl text-white">Ya avisamos que llegaste</p>
                      : <div><button className={principal} disabled={cargando} onClick={() => llegue(c)}>Ya llegué</button><p className="mt-4 text-center text-xl text-white/60">Al tocar «Ya llegué» le avisamos a {c.profesional || "tu profesional"} que estás aquí.</p></div>}
                </div>
                {modo === "llegue" && <p className="mt-4 text-center text-xl opacity-60">¿Prefieres pagar ahora? Toca «Volver» y elige «Quiero pagar». También puedes pagar al terminar.</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {pantalla === "nohora" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="tt-display mb-2 text-5xl font-semibold">Reserva tu hora</h2>
          <p className="mb-8 text-2xl opacity-70">Elige cómo prefieres hacerlo.</p>
          <div className="space-y-6">
            {info.reservaPantalla && <button className={boton} onClick={() => setPantalla("reservar")}><Opcion t="Reservar en esta pantalla" d="Elige servicio, profesional y hora aquí mismo" /></button>}
            {info.reserva && (
              <div className="flex items-center gap-8 rounded-2xl border border-white/[0.12] bg-white/[0.04] p-8">
                <Qr valor={info.reserva} tamano={280} />
                <div><p className="text-3xl font-bold">Reservar desde tu celular</p><p className="mt-3 text-2xl opacity-70">Abre la cámara de tu celular y apunta al código. Reservas desde ahí, sin escribir nada más aquí.</p></div>
              </div>
            )}
          </div>
        </section>
      )}

      {pantalla === "reservar" && info.reservaPantalla && (
        <section className="flex flex-1 flex-col">
          <div className="mb-4 flex gap-4"><button onClick={() => setPantalla("nohora")} className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-6 py-4 text-xl font-semibold">← Atrás</button><button onClick={inicio} className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-6 py-4 text-xl font-semibold">Ir al inicio</button></div>
          <iframe src={info.reservaPantalla} title="Reservar" className="w-full flex-1 rounded-3xl bg-white" style={{ minHeight: "70vh" }} />
        </section>
      )}

      {pantalla === "pagoterm" && pagoTerm && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="tt-mono mb-4 text-lg uppercase tracking-[0.16em] text-white/50">Pago con tarjeta</p>
          <p className="tt-display mb-6 text-8xl font-semibold">{plata(pagoTerm.monto)}</p>
          <h2 className="tt-display mb-4 text-5xl font-semibold">Pasa o acerca tu tarjeta a la máquina</h2>
          <p className="max-w-xl text-2xl text-white/60">Sigue las instrucciones de la máquina. Esta pantalla se actualiza sola cuando se confirme el pago.</p>
          {pagoTerm.abono > 0 && <p className="mt-3 text-xl opacity-60">Ya descontamos tu abono de {plata(pagoTerm.abono)}.</p>}
          <div className="mt-10 h-3 w-3 rounded-full bg-white/60" style={{ animation: "ttPulse 2.2s infinite" }} />
          <button onClick={cancelarPagoTerminal} className="tt-mono mt-14 rounded-xl border border-white/15 px-6 py-3 text-base uppercase tracking-[0.12em] text-white/70">Cancelar</button>
        </section>
      )}

      {pantalla === "pagoqr" && pagoQr && (
        <section className="flex flex-1 flex-col items-center text-center">
          <div className="self-start">{volver}</div>
          <h2 className="tt-display mb-2 text-5xl font-semibold">Paga con tu celular</h2>
          <p className="mb-8 text-3xl font-bold text-white">{plata(pagoQr.monto)}</p>
          <Qr valor={pagoQr.url} tamano={460} />
          <p className="mt-8 max-w-xl text-2xl opacity-80">Abre la cámara de tu celular, apunta al código y paga con Mercado Pago. Esta pantalla se actualiza sola cuando se confirme.</p>
          {pagoQr.abono > 0 && <p className="mt-3 text-xl opacity-60">Ya descontamos tu abono de {plata(pagoQr.abono)}.</p>}
          <p className="mt-6 text-lg opacity-50">El código vence en 10 minutos.</p>
        </section>
      )}

      {pantalla === "productos" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="tt-display mb-2 text-5xl font-semibold">¿Qué te llevas?</h2>
          <p className="mb-8 text-2xl opacity-70">Elige y avisamos para llevártelo y cobrártelo.</p>
          <div className="space-y-4 pb-6">
            {info.productos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.12] bg-white/[0.04] p-6">
                <div className="min-w-0"><p className="truncate text-3xl font-bold">{p.name}</p><p className="text-2xl opacity-70">{plata(p.price)}</p></div>
                <div className="flex items-center gap-4">
                  <button className="h-16 w-16 rounded-xl border border-white/20 bg-white/[0.08] text-4xl font-bold active:bg-white/15" onClick={() => setCarrito((c) => ({ ...c, [p.id]: Math.max(0, (c[p.id] || 0) - 1) }))}>−</button>
                  <span className="w-10 text-center text-4xl font-semibold">{carrito[p.id] || 0}</span>
                  <button className="h-16 w-16 rounded-xl border border-white/20 bg-white/[0.08] text-4xl font-bold active:bg-white/15" onClick={() => setCarrito((c) => ({ ...c, [p.id]: Math.min(10, (c[p.id] || 0) + 1) }))}>+</button>
                </div>
              </div>
            ))}
          </div>
          {msg && <p className="mb-4 rounded-2xl bg-red-500/15 p-5 text-2xl text-red-300">{msg}</p>}
          <div className="sticky bottom-0 mt-auto bg-[#0A0A0A] pt-4">
            <button className={principal} disabled={total === 0 || cargando} onClick={pedirProductos}>{total > 0 ? `Pedir · ${plata(total)}` : "Elige un producto"}</button>
          </div>
        </section>
      )}

      {pantalla === "info" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="tt-display mb-8 text-5xl font-semibold">Cursos, promociones y planes</h2>
          <div className="space-y-5">
            {info.info.map((s, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-8">
                <p className="text-3xl font-bold">{s.title}</p>
                <p className="mt-3 whitespace-pre-line text-2xl leading-relaxed opacity-80">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {pantalla === "gracias" && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <svg className="mb-10 h-24 w-24 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12.5l3 3 6-7" /></svg>
          <p className="text-5xl font-semibold leading-snug">{gracias}</p>
          <button onClick={inicio} className="mt-14 rounded-xl border border-white/[0.12] bg-white/[0.04] px-10 py-5 text-2xl font-semibold">Listo</button>
        </section>
      )}
      <footer className="mt-10 flex items-center gap-4 pt-6">
        <span className="tt-mono text-sm uppercase tracking-[0.16em] text-white/35">Con tecnología de</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Logo%20RE-BOOKING%20Oficial%2002.png" alt="re-booking" className="h-8 w-auto opacity-90" />
      </footer>
    </main>
    </div>
  );
}

export default function TotemPage() {
  return <Suspense fallback={null}><Totem /></Suspense>;
}
