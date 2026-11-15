"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Qr } from "@/components/totem/qr";

// Tótem de autoatención: pantalla HORIZONTAL táctil en el local (pensado para 1920x1080; todo escala con el tamaño de la pantalla).
// Sin sesión: todo pasa por /api/totem/* con el código corto de la cita. Vuelve solo al inicio tras 60 s sin tocarlo.
// En pantallas angostas (celular vertical) las columnas se apilan, pero el diseño es horizontal.

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
      <div className="absolute -left-40 -top-40 h-[40rem] w-[40rem] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.07), transparent)" }} />
      <div className="absolute -bottom-48 -right-40 h-[40rem] w-[40rem] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.05), transparent)" }} />
      {/* tarjetas flotantes (como las del landing), sin texto */}
      <div className={`${tarjeta} right-[1%] top-[4%] h-28 w-60 opacity-80`} style={{ animation: "ttFloat 7s ease-in-out infinite" }}>
        <span className="absolute left-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/80"><svg className="h-5 w-5 text-[#0A0A0A]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12.5l4 4 8-9" /></svg></span>
        <span className="absolute left-[68px] top-6 h-2.5 w-24 rounded-full bg-white/25" /><span className="absolute left-[68px] top-11 h-2.5 w-16 rounded-full bg-white/15" />
        <span className="absolute bottom-4 left-5 h-2 w-40 rounded-full bg-white/10" />
      </div>
      <div className={`${tarjeta} bottom-[4%] left-[1%] h-24 w-56 opacity-75`} style={{ animation: "ttFloat 8.4s ease-in-out 1s infinite" }}>
        <span className="absolute left-5 top-5 h-9 w-9 rounded-xl bg-white/15" />
        <span className="absolute left-[68px] top-6 h-2.5 w-20 rounded-full bg-white/25" /><span className="absolute left-[68px] top-11 h-2.5 w-28 rounded-full bg-white/15" />
      </div>
      <div className={`${tarjeta} bottom-[5%] right-[1%] h-20 w-44 opacity-70`} style={{ animation: "ttFloat 9s ease-in-out 0.5s infinite" }}>
        <span className="absolute left-4 top-4 h-2.5 w-12 rounded-full bg-white/25" />
        <span className="absolute bottom-4 left-4 flex items-end gap-1.5"><i className="block h-4 w-2.5 rounded-sm bg-white/20" /><i className="block h-7 w-2.5 rounded-sm bg-white/30" /><i className="block h-5 w-2.5 rounded-sm bg-white/20" /><i className="block h-9 w-2.5 rounded-sm bg-white/40" /></span>
      </div>
      {/* círculos y puntos */}
      <span className="absolute right-[30%] top-[30%] h-24 w-24 rounded-full border border-white/[0.12]" style={{ animation: "ttDrift 11s ease-in-out infinite" }} />
      <span className="absolute left-[8%] top-[18%] h-10 w-10 rounded-full border border-white/[0.18]" style={{ animation: "ttDrift 9s ease-in-out 1s infinite" }} />
      <span className="absolute bottom-[30%] right-[8%] h-3.5 w-3.5 rounded-full bg-white/40" style={{ animation: "ttDrift 8s ease-in-out 0.4s infinite, ttPulse 2.8s infinite" }} />
      <span className="absolute left-[30%] top-[6%] h-2.5 w-2.5 rounded-full bg-white/30" style={{ animation: "ttDrift 10s ease-in-out 2s infinite" }} />
    </div>
  );
}

// Teclado en pantalla (letras y números sin O/0/I/1). Se usa para el código del cliente y el del negocio.
function Teclado({ onTecla, onBorrar, columnas = 8 }: { onTecla: (k: string) => void; onBorrar: () => void; columnas?: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
      {[...LETRAS, ...NUMEROS].map((k) => (
        <button key={k} onClick={() => onTecla(k)} className="rounded-xl border border-white/[0.12] bg-white/[0.04] py-5 text-4xl font-bold active:bg-white/15">{k}</button>
      ))}
      <button onClick={onBorrar} className="rounded-xl border border-white/20 bg-white/[0.08] py-5 text-2xl font-bold active:bg-white/15" style={{ gridColumn: `span ${columnas}` }}>Borrar</button>
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
  const [pagoTerm, setPagoTerm] = useState<{ id: string; monto: number; abono: number; profesional: string | null } | null>(null);
  const [instalador, setInstalador] = useState<any>(null); // evento «beforeinstallprompt» de Chrome (instalar como aplicación)
  const [instalada, setInstalada] = useState(false);
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

  // Pantalla completa: sin la barra de Chrome. Si el tótem está instalado como aplicación ya abre así; si se abrió en el navegador,
  // al primer toque se pide pantalla completa (el navegador solo la permite después de un toque).
  useEffect(() => {
    try { setInstalada(window.matchMedia("(display-mode: fullscreen)").matches || window.matchMedia("(display-mode: standalone)").matches); } catch { /* */ }
    const alInstalar = (e: Event) => { e.preventDefault(); setInstalador(e); };
    const yaInstalada = () => { setInstalada(true); setInstalador(null); };
    window.addEventListener("beforeinstallprompt", alInstalar);
    window.addEventListener("appinstalled", yaInstalada);
    const pantallaCompleta = () => {
      try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch { /* */ }
    };
    window.addEventListener("pointerdown", pantallaCompleta, { once: true });
    return () => { window.removeEventListener("beforeinstallprompt", alInstalar); window.removeEventListener("appinstalled", yaInstalada); window.removeEventListener("pointerdown", pantallaCompleta); };
  }, []);

  // Después de "gracias", vuelve solo.
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
    if (!d.citas?.length) { setMsg("No encontramos ese código para hoy. Pídelo a quien te atiende."); return; }
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
    setPagoTerm({ id: d.id, monto: d.monto, abono: d.abono, profesional: d.profesional || null });
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

  const instalar = async () => {
    if (!instalador) return;
    try { instalador.prompt(); await instalador.userChoice; } catch { /* */ }
    setInstalador(null);
  };

  const colorFondo = "bg-[#0A0A0A] text-white";
  const boton = "tt-display flex w-full items-center justify-between gap-6 rounded-2xl border border-white/[0.12] bg-white/[0.04] px-8 py-5 text-left text-3xl font-semibold transition active:scale-[0.995] active:bg-white/[0.08]";
  const principal = "tt-display w-full rounded-2xl bg-white px-8 py-6 text-center text-3xl font-semibold text-[#0A0A0A] transition active:bg-white/80 disabled:opacity-40";
  const secundario = "w-full rounded-2xl border border-white/[0.12] bg-white/[0.04] px-8 py-5 text-center text-2xl font-bold active:bg-white/10";
  const aviso = "rounded-2xl bg-red-500/15 p-5 text-2xl text-red-300";
  const caja = "rounded-2xl border border-white/[0.12] bg-white/[0.04]";
  const volver = (
    <button onClick={inicio} className="tt-mono mb-6 self-start rounded-xl border border-white/[0.12] px-5 py-3 text-base uppercase tracking-[0.12em] text-white/60">← Inicio</button>
  );
  const contenedor = "relative z-10 mx-auto flex min-h-screen w-full max-w-[112rem] flex-col px-14 py-8";

  // Pantalla de configuración del equipo (primera vez o código inválido).
  if (codigo === null) return <main className={`flex min-h-screen items-center justify-center text-2xl ${colorFondo}`}>Cargando…</main>;
  if (codigo === "") {
    return (
      <div className="relative min-h-screen bg-[#0A0A0A]">
        <Fondo />
        <main className={`${contenedor} text-white`}>
          <div className="grid flex-1 items-center gap-x-16 gap-y-8 md:grid-cols-2">
            <div>
              <h1 className="tt-display mb-4 text-6xl font-semibold">Configurar este tótem</h1>
              <p className="mb-8 text-2xl text-white/65">Escribe el código del negocio (7 letras o números). Lo encuentras en re-booking, en Configuración &gt; Tótem de autoatención. Se guarda en este equipo y no se vuelve a pedir.</p>
              <div className="mb-8 flex gap-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex h-24 w-[4.5rem] items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] text-5xl font-semibold">{escrito[i] || ""}</div>
                ))}
              </div>
              {msg && <p className={`mb-6 ${aviso}`}>{msg}</p>}
              <button className={principal} disabled={escrito.length !== 7} onClick={() => setCodigo(escrito)}>Abrir tótem</button>
              {!instalada && instalador && (
                <button onClick={instalar} className={`${secundario} mt-4`}>Instalar como aplicación (sin barra de Chrome)</button>
              )}
              {!instalada && !instalador && (
                <p className="mt-5 text-lg text-white/50">Para quitar la barra de Chrome: menú de Chrome (⋮) &gt; «Instalar app» o «Agregar a la pantalla de inicio», y abre el tótem desde ese ícono.</p>
              )}
            </div>
            <Teclado onTecla={(k) => { setMsg(""); setEscrito((c) => (c.length < 7 ? c + k : c)); }} onBorrar={() => setEscrito((c) => c.slice(0, -1))} />
          </div>
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
    <main className={`${contenedor} select-none ${colorFondo.replace("bg-[#0A0A0A] ", "")}`} style={{ touchAction: "manipulation" }}>
      <header className="mb-6 flex items-center gap-6" onClick={() => {
        // Personal del local: 5 toques seguidos al nombre del negocio vuelven a pedir el código.
        const n = tocesLogo + 1; setTocesLogo(n);
        setTimeout(() => setTocesLogo(0), 3000);
        if (n >= 5) { try { localStorage.removeItem("totem_codigo"); } catch { /* */ } setEscrito(""); setCodigo(""); inicio(); }
      }}>
        {info.negocio.logo_url && (
          // El logo del negocio va sobre un cuadro claro: muchos logos son oscuros y se perderían sobre el negro.
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={info.negocio.logo_url} alt={info.negocio.name} className="h-20 w-20 rounded-3xl bg-white object-contain p-2" />
        )}
        <p className="tt-mono text-lg uppercase tracking-[0.16em] text-white/60">{info.negocio.name}</p>
      </header>

      {pantalla === "inicio" && (
        <section className="grid flex-1 items-center gap-x-20 gap-y-8 md:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="tt-mono mb-4 text-lg uppercase tracking-[0.16em] text-white/60">Autoatención</p>
            <h1 className="tt-display text-8xl font-semibold leading-[1.02] tracking-tight">Bienvenido.</h1>
            <p className="tt-display mt-5 text-5xl font-medium leading-tight text-white/60">¿Cómo te podemos ayudar?</p>
          </div>
          <div className="space-y-4">
            <button className={boton} onClick={() => { setModo("llegue"); setPantalla("codigo"); }}><Opcion n="01" t="Tengo hora" d="Avisa que llegaste con tu código" /></button>
            <button className={boton} onClick={() => setPantalla("nohora")}><Opcion n="02" t="No tengo hora" d="Reserva aquí o desde tu celular" /></button>
            <button className={boton} onClick={() => { setModo("pagar"); setPantalla("codigo"); }}><Opcion n="03" t="Quiero pagar" d="Con tarjeta, desde tu celular o en caja" /></button>
            {info.productos.length > 0 && <button className={boton} onClick={() => setPantalla("productos")}><Opcion n="04" t="Comprar un producto" d="Bebidas, energéticas y más" /></button>}
            {info.info.length > 0 && <button className={boton} onClick={() => setPantalla("info")}><Opcion n="05" t="Cursos, promociones y planes" d="Conoce lo que tenemos para ti" /></button>}
          </div>
        </section>
      )}

      {pantalla === "codigo" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <div className="grid flex-1 items-center gap-x-16 gap-y-8 md:grid-cols-2">
            <div>
              <h2 className="tt-display mb-3 text-6xl font-semibold">{modo === "pagar" ? "Escribe tu código para pagar" : "Escribe tu código"}</h2>
              <p className="mb-8 text-2xl text-white/65">{modo === "pagar" ? "Son 5 letras o números. Después podrás pagar con tarjeta, desde tu celular o en caja: si eliges caja, le avisamos al equipo para que te atienda." : "Son 5 letras o números. Es tu código personal: lo ves al confirmar tu reserva. Si no lo recuerdas, pídelo a quien te atiende."}</p>
              <div className="mb-8 flex gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex h-28 w-24 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] text-6xl font-semibold">{code[i] || ""}</div>
                ))}
              </div>
              {msg && <p className={`mb-6 ${aviso}`}>{msg}</p>}
              <button className={principal} disabled={code.length !== 5 || cargando} onClick={buscar}>{cargando ? "Buscando…" : "Continuar"}</button>
            </div>
            <Teclado onTecla={(k) => { setMsg(""); setCode((c) => (c.length < 5 ? c + k : c)); }} onBorrar={() => setCode((c) => c.slice(0, -1))} />
          </div>
        </section>
      )}

      {pantalla === "cita" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="tt-display mb-6 text-6xl font-semibold">{citas.length > 1 ? "Encontramos estas citas" : "Esta es tu cita"}</h2>
          {msg && <p className={`mb-6 ${aviso}`}>{msg}</p>}
          <div className="space-y-5">
            {citas.map((c) => (
              <div key={c.id} className={`${caja} grid items-center gap-x-12 gap-y-6 p-8 md:grid-cols-[1fr_1.2fr]`}>
                <div>
                  {c.fecha && <p className="mb-2 text-2xl font-semibold text-white">{new Date(`${c.fecha}T12:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })} (modo pruebas)</p>}
                  <p className="tt-display text-8xl font-semibold">{c.hora}</p>
                  <p className="mt-3 text-3xl font-semibold">{c.servicio}</p>
                  <p className="mt-1 text-2xl text-white/65">con {c.profesional || "tu profesional"} · {c.cliente}</p>
                </div>
                <div>
                  {modo === "pagar"
                    ? <div className="space-y-4">
                        {info.pagoTerminal && (info.tarjetaElige ? (
                          <div className="grid grid-cols-2 gap-4">
                            <button className={principal} disabled={cargando} onClick={() => crearPagoTerminal(c, "debito")}>{cargando ? "Enviando…" : "Pagar con débito"}</button>
                            <button className={principal} disabled={cargando} onClick={() => crearPagoTerminal(c, "credito")}>{cargando ? "Enviando…" : "Pagar con crédito"}</button>
                          </div>
                        ) : <button className={principal} disabled={cargando} onClick={() => crearPagoTerminal(c, "debito")}>{cargando ? "Enviando a la máquina…" : "Pagar con tarjeta aquí"}</button>)}
                        {info.pagoQr && <button className={info.pagoTerminal ? secundario : principal} disabled={cargando} onClick={() => crearPagoQr(c)}>{cargando ? "Creando QR…" : "Pagar desde mi celular (QR)"}</button>}
                        <button className={(info.pagoQr || info.pagoTerminal) ? secundario : principal} disabled={cargando} onClick={() => pedirPagar(c)}>{(info.pagoQr || info.pagoTerminal) ? "Prefiero pagar en caja (avisamos al equipo)" : "Quiero pagar en caja (avisamos al equipo)"}</button>
                        <p className="pt-1 text-center text-xl text-white/60">Si pagas en caja, le avisamos a {c.profesional || "tu profesional"} y al equipo para que te atiendan.</p>
                      </div>
                    : c.llego
                      ? <p className="rounded-2xl bg-white/10 p-5 text-center text-2xl text-white">Ya avisamos que llegaste</p>
                      : <div>
                          <button className={principal} disabled={cargando} onClick={() => llegue(c)}>Ya llegué</button>
                          <p className="mt-4 text-center text-xl text-white/60">Al tocar «Ya llegué» le avisamos a {c.profesional || "tu profesional"} que estás aquí.</p>
                          <p className="mt-2 text-center text-xl text-white/45">¿Prefieres pagar ahora? Toca «Inicio» y elige «Quiero pagar». También puedes pagar al terminar.</p>
                        </div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {pantalla === "nohora" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="tt-display mb-2 text-6xl font-semibold">Reserva tu hora</h2>
          <p className="mb-8 text-2xl text-white/65">Elige cómo prefieres hacerlo.</p>
          <div className="grid flex-1 items-stretch gap-6 md:grid-cols-2">
            {info.reservaPantalla && (
              <button className={`${caja} flex flex-col items-start justify-between gap-6 p-10 text-left active:bg-white/10`} onClick={() => setPantalla("reservar")}>
                <span><span className="tt-display block text-5xl font-semibold">Reservar en esta pantalla</span><span className="mt-4 block text-2xl text-white/65">Elige servicio, profesional y hora aquí mismo.</span></span>
                <span aria-hidden className="text-5xl text-white/40">→</span>
              </button>
            )}
            {info.reserva && (
              <div className={`${caja} flex items-center gap-8 p-10`}>
                <Qr valor={info.reserva} tamano={300} />
                <div><p className="tt-display text-4xl font-semibold">Reservar desde tu celular</p><p className="mt-3 text-2xl text-white/65">Abre la cámara de tu celular y apunta al código. Reservas desde ahí, sin escribir nada más aquí.</p></div>
              </div>
            )}
          </div>
        </section>
      )}

      {pantalla === "reservar" && info.reservaPantalla && (
        <section className="flex flex-1 flex-col">
          <div className="mb-4 flex gap-4"><button onClick={() => setPantalla("nohora")} className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-6 py-4 text-xl font-semibold">← Atrás</button><button onClick={inicio} className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-6 py-4 text-xl font-semibold">Ir al inicio</button></div>
          <iframe src={info.reservaPantalla} title="Reservar" className="w-full flex-1 rounded-3xl bg-white" style={{ minHeight: "60vh" }} />
        </section>
      )}

      {pantalla === "pagoterm" && pagoTerm && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="tt-mono mb-4 text-lg uppercase tracking-[0.16em] text-white/50">Pago con tarjeta</p>
          <p className="tt-display mb-6 text-9xl font-semibold">{plata(pagoTerm.monto)}</p>
          <h2 className="tt-display mb-4 max-w-5xl text-5xl font-semibold">{pagoTerm.profesional ? `Pasa o acerca tu tarjeta a la máquina de ${pagoTerm.profesional}` : "Pasa o acerca tu tarjeta a la máquina"}</h2>
          <p className="max-w-3xl text-2xl text-white/60">Sigue las instrucciones de la máquina. Esta pantalla se actualiza sola cuando se confirme el pago.</p>
          {pagoTerm.abono > 0 && <p className="mt-3 text-xl text-white/60">Ya descontamos tu abono de {plata(pagoTerm.abono)}.</p>}
          <div className="mt-10 h-3 w-3 rounded-full bg-white/60" style={{ animation: "ttPulse 2.2s infinite" }} />
          <button onClick={cancelarPagoTerminal} className="tt-mono mt-12 rounded-xl border border-white/15 px-6 py-3 text-base uppercase tracking-[0.12em] text-white/70">Cancelar</button>
        </section>
      )}

      {pantalla === "pagoqr" && pagoQr && (
        <section className="flex flex-1 flex-col">
          {volver}
          <div className="grid flex-1 items-center gap-x-16 gap-y-8 md:grid-cols-[auto_1fr]">
            <Qr valor={pagoQr.url} tamano={420} />
            <div>
              <h2 className="tt-display mb-3 text-6xl font-semibold">Paga con tu celular</h2>
              <p className="tt-display mb-6 text-7xl font-semibold">{plata(pagoQr.monto)}</p>
              <p className="max-w-2xl text-2xl text-white/75">Abre la cámara de tu celular, apunta al código y paga con Mercado Pago. Esta pantalla se actualiza sola cuando se confirme.</p>
              {pagoQr.abono > 0 && <p className="mt-3 text-xl text-white/60">Ya descontamos tu abono de {plata(pagoQr.abono)}.</p>}
              <p className="mt-6 text-lg text-white/50">El código vence en 10 minutos.</p>
            </div>
          </div>
        </section>
      )}

      {pantalla === "productos" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="tt-display mb-2 text-6xl font-semibold">¿Qué te llevas?</h2>
          <p className="mb-6 text-2xl text-white/65">Elige y avisamos para llevártelo y cobrártelo.</p>
          <div className="grid gap-4 pb-6 md:grid-cols-2">
            {info.productos.map((p) => (
              <div key={p.id} className={`${caja} flex items-center justify-between gap-4 p-5`}>
                <div className="min-w-0"><p className="truncate text-3xl font-bold">{p.name}</p><p className="text-2xl text-white/65">{plata(p.price)}</p></div>
                <div className="flex items-center gap-4">
                  <button className="h-16 w-16 rounded-xl border border-white/20 bg-white/[0.08] text-4xl font-bold active:bg-white/15" onClick={() => setCarrito((c) => ({ ...c, [p.id]: Math.max(0, (c[p.id] || 0) - 1) }))}>−</button>
                  <span className="w-10 text-center text-4xl font-semibold">{carrito[p.id] || 0}</span>
                  <button className="h-16 w-16 rounded-xl border border-white/20 bg-white/[0.08] text-4xl font-bold active:bg-white/15" onClick={() => setCarrito((c) => ({ ...c, [p.id]: Math.min(10, (c[p.id] || 0) + 1) }))}>+</button>
                </div>
              </div>
            ))}
          </div>
          {msg && <p className={`mb-4 ${aviso}`}>{msg}</p>}
          <div className="sticky bottom-0 mt-auto bg-[#0A0A0A] pt-4">
            <button className={principal} disabled={total === 0 || cargando} onClick={pedirProductos}>{total > 0 ? `Pedir · ${plata(total)}` : "Elige un producto"}</button>
          </div>
        </section>
      )}

      {pantalla === "info" && (
        <section className="flex flex-1 flex-col">
          {volver}
          <h2 className="tt-display mb-6 text-6xl font-semibold">Cursos, promociones y planes</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {info.info.map((s, i) => (
              <div key={i} className={`${caja} p-8`}>
                <p className="tt-display text-4xl font-semibold">{s.title}</p>
                <p className="mt-3 whitespace-pre-line text-2xl leading-relaxed text-white/75">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {pantalla === "gracias" && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <svg className="mb-10 h-24 w-24 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12.5l3 3 6-7" /></svg>
          <p className="tt-display max-w-5xl text-6xl font-semibold leading-snug">{gracias}</p>
          <button onClick={inicio} className="mt-12 rounded-xl border border-white/[0.12] bg-white/[0.04] px-10 py-5 text-2xl font-semibold">Listo</button>
        </section>
      )}
      <footer className="mt-8 flex items-center gap-4 pt-4">
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
