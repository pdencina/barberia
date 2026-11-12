"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Send, ArrowRight, LifeBuoy, Mic } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { todayInChile } from "@/lib/utils";
import { SUPPORT_AREAS } from "@/lib/support";
import { buscarAyuda } from "@/lib/oti/buscar";
import { entenderBloqueo, etiquetaFecha, type MiembroEquipo, type PedidoBloqueo } from "@/lib/oti/bloqueo";
import { CATALOGO, type EntradaOti } from "@/lib/oti/catalogo";
import { norm } from "@/lib/oti/texto";
import { entenderConsulta, NOMBRE_MEDIO, periodo, type ConsultaOti } from "@/lib/oti/consulta";
import { useOtiVisible, ocultarOti, mostrarOti, leerPosicion, guardarPosicion, type PosicionOti } from "@/lib/oti/visibilidad";
import { MEDIOS_PAGO_NEGOCIO, pareceDelNegocio } from "@/lib/oti/negocio";
import { entenderNota, buscarNotas, estadoVencimiento, ordenarNotas, type NotaOti } from "@/lib/oti/notas";
import { entenderMovimientoPersonal, entenderResumenPersonal, extraerMonto, CATEGORIAS_GASTO, CATEGORIAS_INGRESO, type MovimientoPersonal } from "@/lib/oti/personal";

type Mensaje =
  | { de: "oti"; tipo: "texto"; texto: string }
  | { de: "yo"; tipo: "texto"; texto: string }
  | { de: "oti"; tipo: "ayuda"; entrada: EntradaOti }
  | { de: "oti"; tipo: "confirmar"; pedido: Extract<PedidoBloqueo, { ok: true }>; estado: "pendiente" | "hecho" | "cancelado" }
  | { de: "oti"; tipo: "soporte"; pregunta: string }
  | { de: "oti"; tipo: "personal"; mov: MovimientoPersonal; estado: "pendiente" | "hecho" | "cancelado"; destino?: "personal" | "negocio"; medio?: string }
  | { de: "oti"; tipo: "nota"; texto: string; dia: number | null; estado: "pendiente" | "hecho" | "cancelado" }
  | { de: "oti"; tipo: "borrarNota"; notas: NotaOti[]; sel?: string; estado: "pendiente" | "hecho" | "cancelado" }
  | { de: "oti"; tipo: "opciones"; opciones: { texto: string; ayuda?: EntradaOti; relleno?: string; soporte?: string }[] };

const formatCLP = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
// Atajos genéricos: al tocarlos se escribe la frase en la caja de texto (no se envía) para que la persona la complete.
const SUGERENCIAS = [
  { titulo: "Cerrar mi agenda", frase: "Cierra mi agenda el " },
  { titulo: "Anotar un gasto personal", frase: "Gasté $ en " },
  { titulo: "Anotar un ingreso personal", frase: "Recibí $ por " },
  { titulo: "Ver mis gastos del mes", frase: "¿Cuánto gasté este mes?" },
  { titulo: "Dejar una nota", frase: "Recuérdame ", soloAdmin: true },
];
// Ejemplos de pedidos de cierre: se muestran mientras la persona escribe algo parecido.
const EJEMPLOS_CIERRE = ["Cierra mañana mi agenda", "Cierra el domingo mi agenda", "Cierra del 28 al 30 de octubre mi agenda"];
const PARECE_CIERRE = /\b(cier|cerr|bloq|ausent|libre|no (?:voy|atiend|trabaj))/;
const SALUDO: Mensaje = { de: "oti", tipo: "texto", texto: "¡Hola! Soy Oti, tu asistente. Te explico dónde está cada cosa, cierro días de un profesional y anoto tus gastos personales en Mi Billetera (por ejemplo: «pagué la cuenta de la luz $45.000»). Aún estoy en desarrollo y puedo equivocarme." };

const falta = (r: Extract<PedidoBloqueo, { ok: false }>): string => {
  switch (r.falta) {
    case "profesional": return "¿Para qué profesional? Escribe su nombre, por ejemplo: «cierra mañana a [nombre]», o «cierra mañana mi agenda» si es la tuya.";
    case "ambiguo": return `Hay más de un profesional con ese nombre (${(r.candidatos || []).map((c) => c.name).join(", ")}). Escribe el nombre completo.`;
    case "fecha": return "¿Qué día? Por ejemplo: «mañana», «el domingo», «el 30 de octubre» o «del 28 al 30 de octubre».";
    case "hasta": return "¿Hasta cuándo? Por ejemplo: «hasta el 15 de noviembre».";
    case "pasado": return "Esa fecha ya pasó. Dime una fecha de hoy en adelante.";
    case "rango": return "No entendí el rango de fechas. Prueba: «del 28 al 30 de octubre».";
    case "largo": return "Es un período muy largo para hacerlo desde aquí (máximo 120 días). Dime un período más corto.";
  }
};

// Oti: asistente de tareas pequeñas del panel. Sin IA: busca en un catalogo de ayuda hecho con lo que existe en el sistema y entiende pedidos simples de
// «cerrar dias». No inventa ni sale a internet; si no sabe, ofrece enviar un reporte a soporte. Cualquier cambio pide confirmacion y se hace con los
// permisos de quien lo usa (el servidor valida sesion y negocio).
export function OtiWidget() {
  const { user, effectiveRole, role } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [msgs, setMsgs] = useState<Mensaje[]>([SALUDO]);
  const [equipo, setEquipo] = useState<MiembroEquipo[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [soporte, setSoporte] = useState<{ pregunta: string } | null>(null);
  const [faltaMonto, setFaltaMonto] = useState<string | null>(null); // frase de gasto a la que le falta el monto
  const fin = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const r = effectiveRole || role;
  const esAdmin = r === "admin" || r === "super_admin";

  useEffect(() => { fin.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, abierto, soporte]);

  // Historial: los últimos mensajes se guardan en este navegador (por usuario) para verlos al volver a abrir el chat.
  const claveHistorial = user?.id ? `oti-historial-${user.id}` : null;
  const [historialListo, setHistorialListo] = useState(false);
  useEffect(() => {
    if (!claveHistorial) return;
    try {
      const g = JSON.parse(localStorage.getItem(claveHistorial) || "[]");
      if (Array.isArray(g) && g.length) setMsgs([SALUDO, ...g]);
    } catch {}
    setHistorialListo(true);
  }, [claveHistorial]);
  useEffect(() => {
    if (!claveHistorial || !historialListo) return;
    // Solo lo que se entiende sin volver a ejecutar nada: textos y movimientos ya resueltos (nunca confirmaciones pendientes).
    const guardables = msgs.slice(1).filter((m) => m.tipo === "texto" || (m.tipo === "personal" && m.estado !== "pendiente")).slice(-40);
    try { localStorage.setItem(claveHistorial, JSON.stringify(guardables)); } catch {}
  }, [msgs, claveHistorial, historialListo]);
  const borrarHistorial = () => { setMsgs([SALUDO]); setSoporte(null); setFaltaMonto(null); if (claveHistorial) { try { localStorage.removeItem(claveHistorial); } catch {} } };

  // ---- Burbuja flotante (como la de Messenger): se arrastra, se pega al borde y se oculta soltándola sobre la «X» de abajo. ----
  const visible = useOtiVisible();
  const TAM = 56;
  const [pos, setPos] = useState<PosicionOti>({ lado: "right", y: 0.78 });
  const [arrastre, setArrastre] = useState<null | { x: number; y: number; sobreX: boolean }>(null);
  const movio = useRef(false);
  const inicio = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  useEffect(() => { const g = leerPosicion(); if (g) setPos(g); }, []);
  useEffect(() => { const f = () => { mostrarOti(); setAbierto(true); }; window.addEventListener("oti-abrir", f); return () => window.removeEventListener("oti-abrir", f); }, []);

  // ---- Voz: el micrófono transcribe a la caja de texto (no envía solo). Usa el reconocimiento de voz del navegador (Safari en iPhone). ----
  const recRef = useRef<any>(null);
  const [vozLista, setVozLista] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [pedirVoz, setPedirVoz] = useState(false);
  useEffect(() => {
    const w = window as any;
    // Dentro de la app del iPhone/Android, el micrófono solo se pide bien desde la versión que lo declara («RebookingMic» en el user agent); en Safari/Chrome siempre.
    const ua = navigator.userAgent || "";
    const enApp = ua.includes("RebookingApp") && !ua.includes("RebookingMic");
    const nativo = !!w.Capacitor?.Plugins?.SpeechRecognition; // plugin de voz de la app (Android, y iPhone en versiones nuevas)
    setVozLista(nativo || (!enApp && !!(w.SpeechRecognition || w.webkitSpeechRecognition)));
  }, []);
  const vozNativa = () => ((window as any).Capacitor?.Plugins?.SpeechRecognition as any) || null;
  // Suelta el micrófono del todo (así se apaga el punto naranja del iPhone): se usa al terminar de hablar, al cerrar el chat, al salir de la pantalla o al enviar.
  const apagarMic = () => {
    const r = recRef.current; recRef.current = null;
    if (r === "nativo") { const n = vozNativa(); try { n?.stop?.(); } catch {} try { n?.removeAllListeners?.(); } catch {} }
    else if (r) { try { r.abort(); } catch { try { r.stop(); } catch {} } }
    setEscuchando(false);
  };
  // Voz nativa (app): pide el permiso del teléfono, transcribe en vivo a la caja de texto y se detiene sola al terminar de hablar.
  const hablarNativo = async (n: any, auto: boolean) => {
    try {
      let perm = await n.checkPermissions?.();
      if (perm?.speechRecognition !== "granted") perm = await n.requestPermissions?.();
      if (perm?.speechRecognition !== "granted") { setEscuchando(false); if (!auto) showToast("Para hablarle a Oti, permite el micrófono: Ajustes › Aplicaciones › re-booking › Permisos.", "error"); return; }
      await n.removeAllListeners?.();
      await n.addListener?.("partialResults", (d: any) => { const t = String(d?.matches?.[0] || "").trim(); if (t) setTexto(t.slice(0, 300)); });
      await n.addListener?.("listeningState", (d: any) => { if (d?.status === "stopped") apagarMic(); });
      recRef.current = "nativo"; setEscuchando(true); setPedirVoz(false);
      await n.start({ language: "es-CL", maxResults: 1, partialResults: true, popup: false });
    } catch { apagarMic(); if (!auto) showToast("No pude usar el micrófono. Escríbele a Oti.", "error"); }
  };
  useEffect(() => { if (!abierto) apagarMic(); }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const f = () => { if (document.visibilityState === "hidden") apagarMic(); };
    document.addEventListener("visibilitychange", f); window.addEventListener("pagehide", apagarMic);
    return () => { document.removeEventListener("visibilitychange", f); window.removeEventListener("pagehide", apagarMic); apagarMic(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hablar = (auto = false) => {
    if (escuchando) { apagarMic(); return; }
    const nat = vozNativa();
    if (nat) { void hablarNativo(nat, auto); return; }
    const w = window as any; const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { showToast("Tu navegador no permite dictar. Escríbele a Oti.", "error"); return; }
    try {
      const rec = new SR();
      rec.lang = "es-CL"; rec.interimResults = true; rec.continuous = false;
      rec.onresult = (e: any) => {
        const t = Array.from(e.results).map((r: any) => r[0]?.transcript || "").join(" ").trim(); setTexto(t.slice(0, 300));
        if (e.results[e.results.length - 1]?.isFinal) apagarMic(); // terminó de hablar: se apaga el micrófono
      };
      rec.onend = () => { if (recRef.current === rec) recRef.current = null; setEscuchando(false); };
      rec.onerror = (e: any) => { setEscuchando(false); if (!auto && (e?.error === "not-allowed" || e?.error === "service-not-allowed")) showToast("El micrófono está bloqueado. En el iPhone: Ajustes › Safari › Micrófono (o Ajustes › re-booking) y activa el permiso; también revisa que el Dictado esté activado.", "error"); };
      recRef.current = rec; rec.start(); setEscuchando(true); setPedirVoz(false);
    } catch { setEscuchando(false); }
  };
  // Enlace del botón del iPhone: /dashboard?oti=hablar abre a Oti con el micrófono a un toque.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("oti") === "hablar") { mostrarOti(); setAbierto(true); setPedirVoz(true); window.history.replaceState(null, "", window.location.pathname); }
    } catch {}
  }, []);
  useEffect(() => { if (abierto && pedirVoz && vozLista) { try { hablar(true); } catch {} } }, [abierto, pedirVoz, vozLista]); // eslint-disable-line react-hooks/exhaustive-deps
  const zonaX = () => ({ cx: window.innerWidth / 2, cy: window.innerHeight - 70 });
  const sobreLaX = (x: number, y: number) => { const z = zonaX(); return Math.hypot(x + TAM / 2 - z.cx, y + TAM / 2 - z.cy) < 70; };
  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    inicio.current = { px: e.clientX, py: e.clientY, ox: r.left, oy: r.top }; movio.current = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const i = inicio.current; if (!i) return;
    const dx = e.clientX - i.px, dy = e.clientY - i.py;
    if (!movio.current && Math.hypot(dx, dy) < 6) return;
    movio.current = true;
    const x = Math.min(window.innerWidth - TAM, Math.max(0, i.ox + dx)), y = Math.min(window.innerHeight - TAM, Math.max(0, i.oy + dy));
    setArrastre({ x, y, sobreX: sobreLaX(x, y) });
  };
  const onUp = () => {
    const i = inicio.current; inicio.current = null;
    if (!i) return;
    if (!movio.current) { setAbierto(true); return; } // un toque (sin arrastrar) abre el chat
    const a = arrastre; setArrastre(null);
    if (!a) return;
    if (a.sobreX) { ocultarOti(); return; }
    const lado: "left" | "right" = a.x + TAM / 2 < window.innerWidth / 2 ? "left" : "right";
    const y = Math.min(0.92, Math.max(0.08, (a.y + TAM / 2) / window.innerHeight));
    const nueva = { lado, y }; setPos(nueva); guardarPosicion(nueva);
  };


  if (!user || !r || r === "client") return null;

  const cargarEquipo = async (): Promise<MiembroEquipo[]> => {
    if (equipo) return equipo;
    try {
      const res = await fetch("/api/barberos", { cache: "no-store" });
      const d = await res.json();
      const lista: MiembroEquipo[] = Array.isArray(d) ? d.filter((m: any) => m?.id && m?.name).map((m: any) => ({ id: m.id, name: m.name })) : [];
      setEquipo(lista);
      return lista;
    } catch { setEquipo([]); return []; }
  };

  const enviar = async (q: string) => {
    const pregunta = q.trim();
    if (!pregunta || ocupado) return;
    apagarMic();
    setTexto("");
    setMsgs((m) => [...m, { de: "yo", tipo: "texto", texto: pregunta }]);
    setOcupado(true);
    try {
      // -2) Notas del administrador (Dashboard): «recuérdame pagar la luz el 5», «ver mis notas», «borra la nota de la luz». Solo administrador;
      // el servidor valida la sesión. Crear y borrar siempre piden confirmar.
      const pedidoNota = esAdmin ? entenderNota(pregunta) : null;
      if (pedidoNota) {
        setFaltaMonto(null);
        const dice = (texto: string) => setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto }]);
        if (pedidoNota.tipo === "crear") { setMsgs((m) => [...m, { de: "oti", tipo: "nota", texto: pedidoNota.texto, dia: pedidoNota.dia, estado: "pendiente" }]); return; }
        try {
          const res = await fetch("/api/notas", { cache: "no-store" });
          const d = await res.json().catch(() => ({}));
          if (!res.ok || d?.migracionPendiente) { dice(d?.migracionPendiente ? "Todavía no están listas las notas (falta una actualización)." : "No pude leer tus notas. Intenta de nuevo."); return; }
          const notas: NotaOti[] = d.notas || [];
          if (pedidoNota.tipo === "listar") {
            if (notas.length === 0) { dice("No tienes notas. Dime, por ejemplo: «recuérdame pagar la luz el 5»."); return; }
            dice("Tus notas:\n" + ordenarNotas(notas, todayInChile()).map((n) => `• ${n.texto}${estadoVencimiento(n.dia, todayInChile()) ? ` (${estadoVencimiento(n.dia, todayInChile())!.texto.toLowerCase()})` : ""}`).join("\n"));
            return;
          }
          const hallas = buscarNotas(notas, pedidoNota.consulta);
          if (notas.length === 0) { dice("No tienes notas para borrar."); return; }
          if (hallas.length === 0) { dice("No encontré una nota que coincida. Escribe «ver mis notas» para ver cuáles tienes."); return; }
          setMsgs((m) => [...m, { de: "oti", tipo: "borrarNota", notas: hallas, estado: "pendiente" }]);
        } catch { dice("No pude conectar. Revisa tu conexión e intenta de nuevo."); }
        return;
      }

      // -1) Gastos e ingresos PERSONALES (Mi Billetera). Privados: se guardan a nombre de quien escribe; Oti siempre pide confirmar.
      let textoPersonal = pregunta;
      if (faltaMonto && extraerMonto(pregunta) && pregunta.split(/\s+/).length <= 4) textoPersonal = `${faltaMonto} ${pregunta}`;
      const resumen = entenderResumenPersonal(pregunta, todayInChile(), periodo);
      if (resumen) {
        setFaltaMonto(null);
        const dice = (texto: string) => setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto }]);
        try {
          const res = await fetch(`/api/personal/movimientos?desde=${resumen.desde}&hasta=${resumen.hasta}`, { cache: "no-store" });
          const d = await res.json().catch(() => ({}));
          if (!res.ok || d?.migracionPendiente) { dice(d?.migracionPendiente ? "Todavía no está lista la sección de gastos personales (falta una actualización)." : "No pude leer tus gastos. Intenta de nuevo."); return; }
          const items: any[] = d.items || [];
          const g = items.filter((i) => i.kind === "expense"), ing = items.filter((i) => i.kind === "income");
          const sum = (a: any[]) => a.reduce((t, i) => t + (Number(i.amount) || 0), 0);
          if (items.length === 0) { dice(`No tienes movimientos anotados ${resumen.etiqueta}.`); return; }
          const porCat = new Map<string, number>(); for (const i of g) porCat.set(i.category, (porCat.get(i.category) || 0) + Number(i.amount));
          const top = Array.from(porCat.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${c} ${formatCLP(v)}`).join(" · ");
          const bal = sum(ing) - sum(g);
          dice(resumen.tipo === "ingreso" ? `Ingresos personales ${resumen.etiqueta}: ${formatCLP(sum(ing))} (${ing.length}).`
            : resumen.tipo === "balance" ? `Balance ${resumen.etiqueta}: ${bal < 0 ? "-" : ""}${formatCLP(Math.abs(bal))} (ingresos ${formatCLP(sum(ing))} − gastos ${formatCLP(sum(g))}).`
            : `Gastos personales ${resumen.etiqueta}: ${formatCLP(sum(g))} en ${g.length} ${g.length === 1 ? "gasto" : "gastos"}.${top ? `\nLo más grande: ${top}.` : ""}${ing.length ? `\nIngresos anotados: ${formatCLP(sum(ing))}.` : ""}`);
        } catch { dice("No pude conectar. Revisa tu conexión e intenta de nuevo."); }
        return;
      }
      const personal = entenderMovimientoPersonal(textoPersonal, todayInChile());
      if (personal) {
        if (!personal.ok) {
          setFaltaMonto(textoPersonal);
          setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "¿Cuánto fue? Dime el monto, por ejemplo «$4.500» o «20 lucas»." }]);
          return;
        }
        setFaltaMonto(null);
        setMsgs((m) => [...m, { de: "oti", tipo: "personal", mov: personal.movimiento, estado: "pendiente", destino: esAdmin && pareceDelNegocio(pregunta) ? "negocio" : "personal" }]);
        return;
      }
      setFaltaMonto(null);

      // 0) ¿Es una pregunta de cifras del negocio? Solo administrador; el servidor lo vuelve a validar (negocio y rol salen de la sesión).
      const eq = await cargarEquipo();
      const cons = entenderConsulta(pregunta, todayInChile(), eq);
      if (cons) {
        const dice = (texto: string) => setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto }]);
        if (r !== "admin" && r !== "super_admin") { dice("Las cifras del negocio solo las puede ver el administrador. Pídeselas a él."); return; }
        if (!cons.ok) { dice(cons.falta === "periodo" ? "¿De qué período? Por ejemplo: «hoy», «ayer», «esta semana», «la semana pasada», «este mes» o «el mes pasado»." : `Hay más de un profesional con ese nombre (${(cons.candidatos || []).map((c) => c.name).join(", ")}). Escribe el nombre completo.`); return; }
        const c: ConsultaOti = cons.consulta;
        try {
          const res = await fetch("/api/oti/consulta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metrica: c.metrica, desde: c.desde, hasta: c.hasta, barberId: c.barberId, medio: c.medio, diaSemana: c.diaSemana, orden: c.orden }) });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) { dice(res.status === 403 ? "Las cifras del negocio solo las puede ver el administrador." : `No pude calcularlo: ${d?.error || "intenta de nuevo"}.`); return; }
          if (d.texto) { dice(d.texto); return; }
          const quien = c.barberNombre ? ` de ${c.barberNombre}` : "";
          const via = c.medio ? ` pagadas con ${NOMBRE_MEDIO[c.medio]}` : "";
          if (c.metrica === "dinero") dice(`Ventas${quien}${via} ${c.etiqueta}: ${d.total} en ${d.ventas} ${d.ventas === 1 ? "venta" : "ventas"}.\nSolo cuento ventas cobradas, sin las anuladas.`);
          else if (c.metrica === "servicios") dice(`Servicios realizados${quien}${via} ${c.etiqueta}: ${d.servicios} (en ${d.ventas} ${d.ventas === 1 ? "venta" : "ventas"}).`);
          else dice(!d.ranking?.length ? `No encontré ventas ${c.etiqueta}.` : `Quién atendió más ${c.etiqueta}:\n` + d.ranking.map((x: any, k: number) => `${k + 1}. ${x.nombre}: ${x.servicios} servicios (${x.dinero})`).join("\n"));
        } catch { dice("No pude conectar. Revisa tu conexión e intenta de nuevo."); }
        return;
      }
      // 1) ¿Es un pedido de cerrar dias?
      const pedido = entenderBloqueo(pregunta, todayInChile(), eq, user.id);
      if (pedido) {
        // Un profesional solo puede cerrar su propia agenda; recepcion, administrador y super admin pueden cerrar la de cualquiera de su negocio.
        if (pedido.ok && r === "barber" && pedido.profesional.id !== user.id) setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "Con tu cuenta solo puedes cerrar tu propia agenda. Pídele a recepción o al administrador que cierre la de otro profesional." }]);
        else if (pedido.ok) setMsgs((m) => [...m, { de: "oti", tipo: "confirmar", pedido, estado: "pendiente" }]);
        else setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: falta(pedido) }]);
        return;
      }
      // 2) Ayuda
      const res = buscarAyuda(pregunta);
      if (res.length > 0) {
        setMsgs((m) => [...m, { de: "oti", tipo: "ayuda", entrada: res[0].entrada }]);
        return;
      }
      // 3) No se
      // Sin coincidencia clara: ofrece opciones parecidas, un ejemplo para cerrar días y el reporte a soporte.
      const parecidas = buscarAyuda(pregunta, CATALOGO, 3, 2);
      const opciones: Extract<Mensaje, { tipo: "opciones" }>["opciones"] = parecidas.map((x) => ({ texto: x.entrada.titulo, ayuda: x.entrada }));
      if (PARECE_CIERRE.test(norm(pregunta)) || /\b(agenda|dia|dias)\b/.test(norm(pregunta))) opciones.push({ texto: "Cerrar días de un profesional", relleno: "Cierra mañana mi agenda" });
      opciones.push({ texto: "Avisar a soporte", soporte: pregunta });
      setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "No estoy seguro de haber entendido. ¿Quisiste decir alguna de estas?" }, { de: "oti", tipo: "opciones", opciones }]);
    } finally { setOcupado(false); }
  };

  const mostrarAyuda = (entrada: EntradaOti) => setMsgs((m) => [...m, { de: "yo", tipo: "texto", texto: entrada.titulo }, { de: "oti", tipo: "ayuda", entrada }]);

  // Mientras escribe: ideas parecidas (ayudas del catálogo y ejemplos de cierre).
  const t = norm(texto);
  const ideasAyuda = t.length >= 2 ? buscarAyuda(texto, CATALOGO, 3, 2).map((x) => x.entrada) : [];
  const ideasCierre = t.length >= 2 && PARECE_CIERRE.test(t) ? EJEMPLOS_CIERRE : [];

  // Administrador: el movimiento va a Ingresos/Egresos del negocio (lo ve el negocio y entra en sus cifras y en la caja si es en efectivo).
  const guardarNegocio = async (i: number, mov: MovimientoPersonal, medio: string) => {
    setOcupado(true);
    try {
      const res = await fetch("/api/oti/movimiento-negocio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: mov.tipo, monto: mov.monto, descripcion: mov.descripcion, fecha: mov.fecha, medio }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: `No pude guardarlo: ${d?.error || "intenta de nuevo"}.` }]); return; }
      const medioTxt = MEDIOS_PAGO_NEGOCIO.find((x) => x.value === medio)?.label || medio;
      setMsgs((m) => m.map((x, k) => (k === i && x.tipo === "personal" ? { ...x, estado: "hecho" as const } : x)).concat([{ de: "oti", tipo: "texto", texto: `Listo, anoté ${mov.tipo === "gasto" ? "un egreso" : "un ingreso"} de ${formatCLP(mov.monto)} (${medioTxt}) en Ingresos/Egresos del negocio.` }]));
      showToast("Anotado en Ingresos/Egresos", "success");
    } catch { setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "No pude conectar. Revisa tu conexión e intenta de nuevo." }]); }
    finally { setOcupado(false); }
  };

  // Notas del administrador: guardar y borrar (el servidor valida sesión y rol; borrar pide un segundo «sí»).
  const guardarNota = async (i: number, texto: string, dia: number | null) => {
    setOcupado(true);
    try {
      const res = await fetch("/api/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto, dia, fuente: "oti" }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: `No pude guardarla: ${d?.error || "intenta de nuevo"}.` }]); return; }
      setMsgs((m) => m.map((x, k) => (k === i && x.tipo === "nota" ? { ...x, estado: "hecho" as const } : x)).concat([{ de: "oti", tipo: "texto", texto: "Listo, dejé la nota en tu Dashboard. Va a seguir ahí hasta que la borres." }]));
      try { window.dispatchEvent(new Event("notas-changed")); } catch {}
      showToast("Nota guardada en tu Dashboard", "success");
    } catch { setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "No pude conectar. Revisa tu conexión e intenta de nuevo." }]); }
    finally { setOcupado(false); }
  };

  const borrarNotaOti = async (i: number, nota: NotaOti) => {
    setOcupado(true);
    try {
      const res = await fetch(`/api/notas?id=${nota.id}`, { method: "DELETE" });
      if (!res.ok) { setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "No pude borrar la nota. Intenta de nuevo." }]); return; }
      setMsgs((m) => m.map((x, k) => (k === i && x.tipo === "borrarNota" ? { ...x, estado: "hecho" as const, notas: x.notas.filter((n) => n.id !== nota.id), sel: undefined } : x)).concat([{ de: "oti", tipo: "texto", texto: `Listo, borré «${nota.texto}».` }]));
      try { window.dispatchEvent(new Event("notas-changed")); } catch {}
      showToast("Nota borrada", "success");
    } catch { setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "No pude conectar. Revisa tu conexión e intenta de nuevo." }]); }
    finally { setOcupado(false); }
  };

  const guardarPersonal = async (i: number, mov: MovimientoPersonal) => {
    setOcupado(true);
    try {
      const res = await fetch("/api/personal/movimientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: mov.tipo === "gasto" ? "expense" : "income", amount: mov.monto, description: mov.descripcion, category: mov.categoria, entry_date: mov.fecha, source: "oti" }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: `No pude guardarlo: ${d?.error || "intenta de nuevo"}.` }]); return; }
      setMsgs((m) => m.map((x, k) => (k === i && x.tipo === "personal" ? { ...x, estado: "hecho" as const } : x)).concat([{ de: "oti", tipo: "texto", texto: `Listo, anoté ${mov.tipo === "gasto" ? "un gasto" : "un ingreso"} de ${formatCLP(mov.monto)} en Mi Billetera › Gastos personales. Solo tú lo ves.` }]));
      try { window.dispatchEvent(new Event("personal-entries-changed")); } catch {}
      showToast("Anotado en Mi Billetera", "success");
    } catch { setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "No pude conectar. Revisa tu conexión e intenta de nuevo." }]); }
    finally { setOcupado(false); }
  };

  const confirmar = async (i: number, pedido: Extract<PedidoBloqueo, { ok: true }>) => {
    setOcupado(true);
    try {
      const res = await fetch("/api/barber/blocks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId: pedido.profesional.id, date: pedido.desde, allDay: true, reason: "Cerrado desde Oti",
          ...(pedido.dias > 1 ? { repeat: { freq: "daily", until: pedido.hasta } } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsgs((m) => m.map((x, k) => (k === i && x.tipo === "confirmar" ? { ...x, estado: "cancelado" as const } : x)).concat([
          { de: "oti", tipo: "texto", texto: res.status === 403 || res.status === 401 ? "No tienes permiso para hacer ese cambio con tu cuenta." : `No pude hacerlo: ${d?.error || "intenta de nuevo"}.` },
          { de: "oti", tipo: "soporte", pregunta: `Oti no pudo bloquear a ${pedido.profesional.name} del ${pedido.desde} al ${pedido.hasta}: ${d?.error || res.status}` },
        ]));
        return;
      }
      setMsgs((m) => m.map((x, k) => (k === i && x.tipo === "confirmar" ? { ...x, estado: "hecho" as const } : x)).concat([
        { de: "oti", tipo: "texto", texto: `Listo. Dejé ${pedido.dias === 1 ? "cerrado el día" : `cerrados ${pedido.dias} días`} de ${pedido.profesional.name}. Lo ves en el Calendario.` },
      ]));
      showToast("Bloqueo creado", "success");
    } catch {
      setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "No pude conectar. Revisa tu conexión e intenta de nuevo." }]);
    } finally { setOcupado(false); }
  };

  return (
    <>
      {!abierto && visible && (
        <>
          {arrastre && (
            <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex h-40 items-end justify-center bg-gradient-to-t from-black/30 to-transparent pb-8">
              <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/80 bg-black/60 text-white shadow-lg transition-transform ${arrastre.sobreX ? "scale-125 bg-red-600" : ""}`}><X className="h-6 w-6" /></div>
            </div>
          )}
          <button type="button" aria-label="Oti, tu asistente (arrástralo para moverlo)" title="Oti · arrástralo para moverlo, suéltalo en la X para ocultarlo"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { inicio.current = null; setArrastre(null); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAbierto(true); } }}
            style={arrastre
              ? { left: arrastre.x, top: arrastre.y, touchAction: "none", cursor: "grabbing" }
              : { [pos.lado]: 12, top: `calc(${Math.round(pos.y * 1000) / 10}% - ${TAM / 2}px)`, touchAction: "none" } as React.CSSProperties}
            className={`fixed z-[65] h-14 w-14 select-none overflow-hidden rounded-full border-2 border-brand-blue bg-white shadow-lg shadow-black/25 ${arrastre ? "scale-110" : "transition-[top,left,right] duration-200"}`}>
            <img src="/oti.webp" alt="Oti" draggable={false} className="pointer-events-none h-full w-full object-cover" />
          </button>
        </>
      )}
      {abierto && (
        <div className="fixed inset-0 z-[70] flex items-end justify-end bg-black/30 p-0 sm:items-end sm:p-5" onClick={() => setAbierto(false)}>
          <div onClick={(e) => e.stopPropagation()} className="flex h-[min(34rem,88vh)] w-full flex-col overflow-hidden rounded-t-3xl border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:w-[24rem] sm:rounded-3xl">
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <img src="/oti.webp" alt="" className="h-10 w-10 rounded-full border border-brand-blue/30 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brand-dark dark:text-gray-100">Oti</p>
                <p className="text-[11px] text-brand-gray">Asistente de tareas pequeñas</p>
              </div>
              {msgs.length > 1 && <button type="button" onClick={borrarHistorial} className="rounded-lg px-2 py-1 text-[11px] text-brand-gray hover:bg-gray-100 dark:hover:bg-gray-800" title="Borra la conversación guardada en este navegador">Borrar historial</button>}
              <button type="button" onClick={() => { setAbierto(false); ocultarOti(); }} className="rounded-lg px-2 py-1 text-[11px] text-brand-gray hover:bg-gray-100 dark:hover:bg-gray-800" title="Oculta la burbuja; puedes volver a abrirlo desde el menú">Ocultar</button>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="rounded-full p-2 text-brand-gray hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {msgs.map((m, i) => {
                if (m.tipo === "texto") return (
                  <div key={i} className={`flex ${m.de === "yo" ? "justify-end" : "justify-start"}`}>
                    <p className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${m.de === "yo" ? "bg-brand-blue text-white" : "bg-gray-100 text-brand-dark dark:bg-gray-800 dark:text-gray-100"}`}>{m.texto}</p>
                  </div>
                );
                if (m.tipo === "ayuda") return (
                  <div key={i} className="max-w-[92%] space-y-2 rounded-2xl bg-gray-100 px-3 py-3 text-sm text-brand-dark dark:bg-gray-800 dark:text-gray-100">
                    <p className="font-bold">{m.entrada.titulo}</p>
                    <p>{m.entrada.resumen}</p>
                    <p className="text-[11px] text-brand-gray">Disponible para: {m.entrada.para}</p>
                    {m.entrada.pasos && <ol className="list-decimal space-y-1 pl-5 text-[13px]">{m.entrada.pasos.map((p, k) => <li key={k}>{p}</li>)}</ol>}
                    {m.entrada.ruta && (
                      <button type="button" onClick={() => { router.push(m.entrada.ruta!); setAbierto(false); }}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white">
                        Abrir pantalla <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
                if (m.tipo === "personal") return (
                  <div key={i} className="max-w-[92%] space-y-2 rounded-2xl border border-brand-blue/30 bg-white px-3 py-3 text-sm dark:bg-gray-900">
                    <p className="font-bold text-brand-dark dark:text-gray-100">{m.destino === "negocio" ? "¿Lo anoto en Ingresos/Egresos del negocio?" : "¿Lo anoto en Mi Billetera?"}</p>
                    {m.estado === "pendiente" ? (
                      <div className="space-y-1.5">
                        <p className={`text-xs font-bold ${m.mov.tipo === "gasto" ? "text-red-600" : "text-emerald-600"}`}>{m.mov.tipo === "gasto" ? "Gasto" : "Ingreso"} · {m.mov.fecha.split("-").reverse().join("/")} <span className="font-normal text-brand-gray">(puedes corregir lo que quieras)</span></p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-brand-dark dark:text-gray-100">$</span>
                          <input inputMode="numeric" aria-label="Monto" value={m.mov.monto ? m.mov.monto.toLocaleString("es-CL") : ""} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); setMsgs((x) => x.map((y, k) => (k === i && y.tipo === "personal" ? { ...y, mov: { ...y.mov, monto: Math.min(100_000_000, n) } } : y))); }} className="w-36 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm font-bold tabular-nums dark:border-gray-700 dark:bg-gray-950" />
                        </div>
                        <input aria-label="En qué fue" maxLength={200} value={m.mov.descripcion} onChange={(e) => setMsgs((x) => x.map((y, k) => (k === i && y.tipo === "personal" ? { ...y, mov: { ...y.mov, descripcion: e.target.value } } : y)))} placeholder="¿En qué fue?" className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950" />
                      </div>
                    ) : (
                    <p className="text-brand-dark dark:text-gray-200">
                      <b className={m.mov.tipo === "gasto" ? "text-red-600" : "text-emerald-600"}>{m.mov.tipo === "gasto" ? "Gasto" : "Ingreso"} de {formatCLP(m.mov.monto)}</b><br />
                      «{m.mov.descripcion}» · {m.mov.fecha.split("-").reverse().join("/")}
                    </p>
                    )}
                    {m.estado === "pendiente" ? (
                      <>
                        {esAdmin && (
                          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-xs dark:border-gray-700">
                            {(["personal", "negocio"] as const).map((d) => (
                              <button key={d} type="button" onClick={() => setMsgs((x) => x.map((y, k) => (k === i && y.tipo === "personal" ? { ...y, destino: d } : y)))} className={`rounded-md px-2.5 py-1 font-semibold ${(m.destino || "personal") === d ? "bg-brand-blue text-white" : "text-brand-gray"}`}>{d === "personal" ? "Personal" : "Del negocio"}</button>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {m.destino === "negocio" ? (
                            <select value={m.medio || ""} onChange={(e) => setMsgs((x) => x.map((y, k) => (k === i && y.tipo === "personal" ? { ...y, medio: e.target.value } : y)))} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950">
                              <option value="">¿Cómo se pagó?</option>
                              {MEDIOS_PAGO_NEGOCIO.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                            </select>
                          ) : (
                          <select value={m.mov.categoria} onChange={(e) => setMsgs((x) => x.map((y, k) => (k === i && y.tipo === "personal" ? { ...y, mov: { ...y.mov, categoria: e.target.value } } : y)))} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950">
                            {[...(m.mov.tipo === "gasto" ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO)].map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          )}
                          <button type="button" onClick={() => setMsgs((x) => x.map((y, k) => (k === i && y.tipo === "personal" ? { ...y, mov: { ...y.mov, tipo: y.mov.tipo === "gasto" ? "ingreso" : "gasto", categoria: y.mov.tipo === "gasto" ? "Otros ingresos" : "Otros" } } : y)))} className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-brand-gray dark:border-gray-700">{m.mov.tipo === "gasto" ? "Es un ingreso" : "Es un gasto"}</button>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" disabled={ocupado || !(m.mov.monto > 0) || !m.mov.descripcion.trim() || (m.destino === "negocio" && !m.medio)} onClick={() => (m.destino === "negocio" ? guardarNegocio(i, m.mov, m.medio || "") : guardarPersonal(i, m.mov))} className="rounded-xl bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Sí, anotar</button>
                          <button type="button" disabled={ocupado} onClick={() => setMsgs((x) => x.map((y, k) => (k === i && y.tipo === "personal" ? { ...y, estado: "cancelado" as const } : y)).concat([{ de: "oti", tipo: "texto", texto: "Listo, no anoté nada." }]))} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-brand-gray dark:border-gray-700">No</button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-brand-gray">
                        <span>{m.estado === "hecho" ? "Anotado." : "Sin cambios."}</span>
                        {m.estado === "hecho" && <button type="button" onClick={() => { router.push(m.destino === "negocio" ? "/dashboard/finanzas" : "/dashboard/mi-billetera"); setAbierto(false); }} className="inline-flex items-center gap-1 rounded-lg border border-brand-blue/40 px-2 py-1 font-semibold text-brand-blue">{m.destino === "negocio" ? "Ver en Ingresos/Egresos" : "Ver mis gastos"} <ArrowRight className="h-3 w-3" /></button>}
                      </div>
                    )}
                  </div>
                );
                if (m.tipo === "nota") return (
                  <div key={i} className="max-w-[92%] space-y-2 rounded-2xl border border-brand-blue/30 bg-white px-3 py-3 text-sm dark:bg-gray-900">
                    <p className="font-bold text-brand-dark dark:text-gray-100">¿Dejo esta nota en tu Dashboard?</p>
                    <p className="rounded-xl bg-brand-light/70 px-3 py-2 text-brand-dark dark:bg-gray-800 dark:text-gray-200">{m.texto}{m.dia ? <span className="block text-xs text-brand-gray">Día {m.dia} de cada mes · te la mostraré siempre, y más destacada los últimos 3 días</span> : <span className="block text-xs text-brand-gray">Se queda visible hasta que la borres</span>}</p>
                    {m.estado === "pendiente" ? (
                      <div className="flex gap-2">
                        <button type="button" disabled={ocupado} onClick={() => guardarNota(i, m.texto, m.dia)} className="rounded-xl bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Sí, dejar nota</button>
                        <button type="button" disabled={ocupado} onClick={() => setMsgs((x) => x.map((y, k) => (k === i && y.tipo === "nota" ? { ...y, estado: "cancelado" as const } : y)).concat([{ de: "oti", tipo: "texto", texto: "Listo, no dejé nada." }]))} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-brand-gray dark:border-gray-700">No</button>
                      </div>
                    ) : <p className="text-xs text-brand-gray">{m.estado === "hecho" ? "Hecho." : "Sin cambios."}</p>}
                  </div>
                );
                if (m.tipo === "borrarNota") return (
                  <div key={i} className="max-w-[92%] space-y-2 rounded-2xl border border-brand-blue/30 bg-white px-3 py-3 text-sm dark:bg-gray-900">
                    <p className="font-bold text-brand-dark dark:text-gray-100">{m.notas.length > 1 ? "¿Cuál nota borro?" : "¿Borro esta nota?"}</p>
                    {m.notas.map((n) => (
                      <div key={n.id} className="space-y-1.5 rounded-xl bg-brand-light/70 px-3 py-2 dark:bg-gray-800">
                        <p className="text-brand-dark dark:text-gray-200">{n.texto}{n.dia ? <span className="text-xs text-brand-gray"> · día {n.dia}</span> : null}</p>
                        {m.sel === n.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-brand-dark dark:text-gray-200">¿Seguro?</span>
                            <button type="button" disabled={ocupado} onClick={() => borrarNotaOti(i, n)} className="rounded-xl bg-red-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">Sí, borrar</button>
                            <button type="button" disabled={ocupado} onClick={() => setMsgs((x) => x.map((y, k) => (k === i && y.tipo === "borrarNota" ? { ...y, sel: undefined } : y)))} className="rounded-xl border border-gray-200 px-3 py-1 text-xs font-semibold text-brand-gray dark:border-gray-700">No</button>
                          </div>
                        ) : m.estado === "pendiente" || m.notas.length > 0 ? (
                          <button type="button" disabled={ocupado} onClick={() => setMsgs((x) => x.map((y, k) => (k === i && y.tipo === "borrarNota" ? { ...y, sel: n.id } : y)))} className="rounded-xl border border-red-200 px-3 py-1 text-xs font-semibold text-red-500 disabled:opacity-50">Borrar</button>
                        ) : null}
                      </div>
                    ))}
                    {m.notas.length === 0 && <p className="text-xs text-brand-gray">Sin más notas por borrar.</p>}
                  </div>
                );
                if (m.tipo === "confirmar") return (
                  <div key={i} className="max-w-[92%] space-y-2 rounded-2xl border border-brand-blue/30 bg-white px-3 py-3 text-sm dark:bg-gray-900">
                    <p className="font-bold text-brand-dark dark:text-gray-100">¿Confirmas?</p>
                    <p className="text-brand-dark dark:text-gray-200">
                      Voy a cerrar la agenda de <b>{m.pedido.profesional.name}</b>{" "}
                      {m.pedido.dias === 1 ? <>el <b>{etiquetaFecha(m.pedido.desde)}</b> (día completo).</> : <>desde el <b>{etiquetaFecha(m.pedido.desde)}</b> hasta el <b>{etiquetaFecha(m.pedido.hasta)}</b> ({m.pedido.dias} días completos).</>}
                    </p>
                    {m.estado === "pendiente" ? (
                      <div className="flex gap-2">
                        <button type="button" disabled={ocupado} onClick={() => confirmar(i, m.pedido)} className="rounded-xl bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Sí, cerrar</button>
                        <button type="button" disabled={ocupado} onClick={() => setMsgs((x) => x.map((y, k) => (k === i && y.tipo === "confirmar" ? { ...y, estado: "cancelado" as const } : y)).concat([{ de: "oti", tipo: "texto", texto: "Listo, no hice nada." }]))} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-brand-gray">Cancelar</button>
                      </div>
                    ) : <p className="text-xs text-brand-gray">{m.estado === "hecho" ? "Hecho." : "Sin cambios."}</p>}
                  </div>
                );
                if (m.tipo === "opciones") return (
                  <div key={i} className="flex flex-col items-start gap-2">
                    {m.opciones.map((o, k) => (
                      <button key={k} type="button" disabled={ocupado}
                        onClick={() => { if (o.ayuda) mostrarAyuda(o.ayuda); else if (o.relleno) setTexto(o.relleno); else if (o.soporte) setSoporte({ pregunta: o.soporte }); }}
                        className="rounded-xl border border-brand-blue/40 px-3 py-1.5 text-left text-xs font-semibold text-brand-blue">{o.soporte ? "🛟 " : ""}{o.texto}</button>
                    ))}
                  </div>
                );
                return (
                  <div key={i}>
                    <button type="button" onClick={() => setSoporte({ pregunta: m.pregunta })} className="inline-flex items-center gap-1.5 rounded-xl border border-brand-blue/40 px-3 py-1.5 text-xs font-semibold text-brand-blue">
                      <LifeBuoy className="h-3.5 w-3.5" /> Preparar reporte para soporte
                    </button>
                  </div>
                );
              })}
              {soporte && <ReporteSoporte pregunta={soporte.pregunta} onCerrar={() => setSoporte(null)} onEnviado={() => { setSoporte(null); setMsgs((m) => [...m, { de: "oti", tipo: "texto", texto: "Listo: envié tu reporte a soporte. Te contactarán al número que dejaste." }]); showToast("Reporte enviado a soporte", "success"); }} />}
              <div ref={fin} />
            </div>

            {msgs.length === 1 && (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {SUGERENCIAS.filter((s) => !(s as any).soloAdmin || esAdmin).map((s) => <button key={s.titulo} type="button" onClick={() => { setTexto(s.frase); setTimeout(() => { const el = campo.current; if (el) { el.focus(); const n = s.frase.length; el.setSelectionRange(n, n); } }, 0); }} className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-semibold text-brand-gray hover:border-brand-blue/40 dark:border-gray-700">{s.titulo}</button>)}
              </div>
            )}
            {texto.trim().length >= 2 && (ideasCierre.length > 0 || ideasAyuda.length > 0) && (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {ideasCierre.map((s) => <button key={s} type="button" onClick={() => setTexto(s)} className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-semibold text-brand-gray hover:border-brand-blue/40 dark:border-gray-700">{s}</button>)}
                {ideasAyuda.map((e) => <button key={e.id} type="button" onClick={() => { setTexto(""); mostrarAyuda(e); }} className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-semibold text-brand-gray hover:border-brand-blue/40 dark:border-gray-700">{e.titulo}</button>)}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }} className="flex items-center gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
              <input ref={campo} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={escuchando ? "Te escucho…" : pedirVoz ? "Toca el micrófono y habla" : "Escríbele a Oti…"} maxLength={300}
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-blue focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              {vozLista && <button type="button" onClick={() => hablar()} aria-label={escuchando ? "Dejar de escuchar" : "Hablar con Oti"} title={escuchando ? "Escuchando… toca para terminar" : "Toca y habla"} className={`rounded-xl border p-2.5 ${escuchando ? "animate-pulse border-red-400 bg-red-50 text-red-600" : pedirVoz ? "animate-pulse border-brand-blue bg-brand-blue/10 text-brand-blue" : "border-gray-200 text-brand-gray dark:border-gray-700"}`}><Mic className="h-4 w-4" /></button>}
              <button type="submit" disabled={ocupado || !texto.trim()} aria-label="Enviar" className="rounded-xl bg-brand-blue p-2.5 text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Reporte a soporte: usa el mismo servicio que «Ayuda y soporte» (POST /api/support). Pide lo que ese servicio exige.
function ReporteSoporte({ pregunta, onCerrar, onEnviado }: { pregunta: string; onCerrar: () => void; onEnviado: () => void }) {
  const [area, setArea] = useState<string>("Otro");
  const [phone, setPhone] = useState("");
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-blue focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

  const enviar = async () => {
    setError(null); setEnviando(true);
    try {
      const form = new FormData();
      form.set("area", area);
      form.set("title", `Oti: ${pregunta}`.slice(0, 120));
      form.set("description", `Le escribí a Oti: «${pregunta}» y no pudo resolverlo.${detalle.trim() ? `\n\nDetalle: ${detalle.trim()}` : ""}`);
      form.set("phone", phone);
      form.set("pageUrl", typeof window !== "undefined" ? window.location.pathname : "");
      form.set("userAgent", typeof navigator !== "undefined" ? navigator.userAgent : "");
      const res = await fetch("/api/support", { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d?.error || "No se pudo enviar. Intenta de nuevo."); return; }
      onEnviado();
    } catch { setError("No se pudo enviar. Revisa tu conexión."); } finally { setEnviando(false); }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-gray-200 p-3 text-sm dark:border-gray-700">
      <p className="font-bold text-brand-dark dark:text-gray-100">Reporte para soporte</p>
      <p className="text-xs text-brand-gray">Se enviará lo que me escribiste: «{pregunta}».</p>
      <select className={input} value={area} onChange={(e) => setArea(e.target.value)}>{SUPPORT_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
      <textarea className={input} rows={2} placeholder="Algo más que quieras contarnos (opcional)" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
      <input className={input} inputMode="tel" placeholder="Tu WhatsApp para contactarte" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {error && <p className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={enviando} onClick={enviar} className="rounded-xl bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{enviando ? "Enviando…" : "Enviar a soporte"}</button>
        <button type="button" onClick={onCerrar} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-brand-gray dark:border-gray-700">Cancelar</button>
      </div>
    </div>
  );
}
