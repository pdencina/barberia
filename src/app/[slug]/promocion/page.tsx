"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { horasDePromo } from "@/lib/promo-link";
import { resumenAbono } from "@/lib/resumen-abono";
import { DesgloseAbono } from "@/components/booking/desglose-abono";
import { calcularAbono } from "@/lib/deposit-calc";
import { textoPoliticaAbono } from "@/lib/deposit-policy";
import { temaPromo } from "@/lib/tema-promo";
import { useFondoLogo } from "@/lib/use-fondo-logo";
import { PromoCabecera } from "@/components/promo/promo-cabecera";

// re-booking.cl/<negocio>/promocion — reserva con los criterios de la promoción ya puestos: solo sus profesionales, días y horas.

interface Pro { id: string; nombre: string; foto: string | null }
interface Servicio { id: string; name: string; price: number; duration: number }
interface Datos {
  negocio: { id: string; nombre: string; slug: string; logo: string | null };
  promo: null | { codigo: string; personas: number; colores: { fondo: string; texto: string; boton: string } | null; politicas: string | null; servicios: string[] | null; descripcion: string | null; tipo: string; valor: number; titulo: string | null; imagen: string | null; horaDesde: string | null; horaHasta: string | null; dias: string[]; detalles: Array<{ etiqueta: string; valor: string }>; profesionales: Pro[] };
  motivo?: string;
}

interface Persona { pro: string; elegidos: string[]; turno: { pro: Pro; slot: string } | null; nombre: string; correo: string; celular: string }
const PERSONA = (): Persona => ({ pro: "", elegidos: [], turno: null, nombre: "", correo: "", celular: "" });

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const fechaCorta = (d: string) => {
  const f = new Date(`${d}T12:00:00Z`);
  const p = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", ...o }).format(f).replace(".", "");
  return { dia: p({ weekday: "short" }), num: p({ day: "numeric" }), mes: p({ month: "short" }), largo: p({ weekday: "long", day: "numeric", month: "long" }) };
};

export default function PromocionPage() {
  const params = useParams();
  const slug = String(params.slug || "");
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [servicios, setServicios] = useState<Record<string, Servicio[]>>({});
  // Una ficha por persona (1, o 2 en las promos «2 personas juntas»). `activa` = a quién se le está eligiendo.
  const [gente, setGente] = useState<Persona[]>([PERSONA(), PERSONA()]);
  const [activa, setActiva] = useState(0);
  const cambiar = (i: number, p: Partial<Persona>) => setGente((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const yo = gente[activa];
  const elegidos = yo.elegidos;
  const setElegidos = (fn: (l: string[]) => string[]) => cambiar(activa, { elegidos: fn(gente[activa].elegidos), turno: null });
  const [dia, setDia] = useState("");
  const [horas, setHoras] = useState<Record<string, string[]>>({});
  const [cargandoHoras, setCargandoHoras] = useState(false);
  const [acepta, setAcepta] = useState(false);
  const [conforme, setConforme] = useState(false); // aceptó las políticas de la promoción
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<Array<{ total: number; descuento: number }> | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [abono, setAbono] = useState<any>(null); // el negocio cobra abono para reservar
  const [revisandoAbono, setRevisandoAbono] = useState(true);

  const normal = `/${encodeURIComponent(slug)}?normal=1`;

  useEffect(() => {
    const cupon = new URLSearchParams(window.location.search).get("cupon") || "";
    fetch(`/api/public/promo?negocio=${encodeURIComponent(slug)}${cupon ? `&cupon=${encodeURIComponent(cupon)}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setDatos(d);
        if (d.promo) {
          setDia(d.promo.dias[0]);
          // Si el negocio pide abono, se cobra desde esta misma página.
          fetch(`/api/settings/deposit?tenantId=${d.negocio.id}`).then((r) => r.json()).then((a) => { if (a?.deposit_enabled && a?.deposit_ready !== false) setAbono(a); }).catch(() => {}).finally(() => setRevisandoAbono(false));
          for (const p of d.promo.profesionales as Pro[]) {
            fetch(`/api/public/barber-services?barberId=${p.id}`).then((r) => r.json()).then((s) => { if (Array.isArray(s)) setServicios((x) => ({ ...x, [p.id]: s })); }).catch(() => {});
          }
        }
      })
      .catch(() => setError("No pudimos cargar la promoción. Revisa tu conexión."));
  }, [slug]);

  const promo = datos?.promo || null;
  const tema = temaPromo(promo?.colores);
  const recuadro = useFondoLogo(datos?.negocio.logo, tema.papel);
  // Primero se elige profesional y recién ahí se muestran SUS servicios (con uno solo, ya viene elegido).
  const solo = promo?.profesionales.length === 1 ? promo.profesionales[0].id : "";
  const miPro = yo.pro || solo;
  const catalogo = useMemo(() => (servicios[miPro] || []).filter((s) => !promo?.servicios || promo.servicios.includes(s.id)), [servicios, miPro, promo]);
  // Se ofrecen los profesionales que hacen al menos un servicio de la promoción.
  const disponibles = (promo?.profesionales || []).filter((p) => !servicios[p.id] || servicios[p.id].some((s) => !promo?.servicios || promo.servicios.includes(s.id)));
  const conDescuento = (n: number) => (!promo || promo.valor <= 0 ? n : promo.tipo === "percentage" ? n - Math.round((n * promo.valor) / 100) : Math.max(0, n - promo.valor));
  // Lo que cobra cada profesional por esos servicios (null = no hace alguno).
  const deProfesional = (id: string, lista: string[] = elegidos) => {
    const l = lista.map((x) => servicios[id]?.find((s) => s.id === x));
    return l.every(Boolean) && l.length ? { total: l.reduce((n, s) => n + s!.price, 0), minutos: l.reduce((n, s) => n + s!.duration, 0) } : null;
  };

  const clave = `${dia}|${activa}|${miPro}|${elegidos.join(",")}|${Object.keys(servicios).length}|${recarga}`;
  useEffect(() => {
    if (!promo || !dia || !elegidos.length) { setHoras({}); return; }
    let vigente = true;
    setCargandoHoras(true);
    Promise.all(promo.profesionales.filter((p) => p.id === miPro).map(async (p) => {
      const x = deProfesional(p.id);
      if (!x) return [p.id, []] as const;
      const d = await fetch(`/api/public/availability?barberId=${p.id}&date=${dia}&duration=${Math.max(5, x.minutos)}`).then((r) => r.json()).catch(() => ({}));
      return [p.id, horasDePromo(d.slots || [], promo.horaDesde, promo.horaHasta)] as const;
    })).then((l) => { if (vigente) { setHoras(Object.fromEntries(l)); setCargandoHoras(false); } });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const cuantos = promo?.personas === 2 ? 2 : 1;
  const grupo = gente.slice(0, cuantos);
  // La otra persona ya tomó ese rato con ese profesional: no se ofrece.
  const choca = (proId: string, slot: string) => grupo.some((g, i) => {
    if (i === activa || !g.turno || g.turno.pro.id !== proId) return false;
    const min = (t: string) => Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16));
    const a = min(slot), b = min(g.turno.slot), mio = deProfesional(proId)?.minutos || 5, suyo = deProfesional(proId, g.elegidos)?.minutos || 5;
    return a < b + suyo && b < a + mio;
  });
  const precioDe = (g: Persona) => (g.turno ? deProfesional(g.turno.pro.id, g.elegidos)?.total || 0 : 0);
  const turnosListos = grupo.every((g) => g.turno);
  const correoValido = (c: string) => /^\S+@\S+\.\S+$/.test(c.trim());
  const completo = turnosListos && grupo.every((g, i) => g.nombre.trim() && g.celular.replace(/\D/g, "").length >= 8 && (i === 0 ? correoValido(g.correo) : !g.correo.trim() || correoValido(g.correo)));

  const precioTurno = precioDe(grupo[0]);
  const cuenta = resumenAbono(precioTurno, precioTurno - conDescuento(precioTurno), abono ? calcularAbono(precioTurno, { mode: abono.deposit_mode, percent: abono.deposit_percentage, fixed: abono.deposit_fixed_amount, minAmount: abono.deposit_min_amount }) : 0);
  const montoAbono = cuenta.abono;
  const abonoSinOnline = !!abono && cuantos === 2; // dos abonos a la vez no se pueden cobrar en línea

  const reservar = async () => {
    if (revisandoAbono || abonoSinOnline) return;
    if (!promo || !completo || (promo.politicas && !conforme)) return;
    setEnviando(true); setError("");
    try {
      const datosDe = (g: Persona) => ({ serviceIds: g.elegidos, barberId: g.turno!.pro.id, startTime: g.turno!.slot, clientName: g.nombre.trim(), clientEmail: g.correo.trim(), clientPhone: g.celular.trim() });
      if (abono) {
        const r = await fetch("/api/booking/create-deposit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...datosDe(grupo[0]), date: dia, marketingConsent: acepta, couponCode: promo.codigo }) });
        const x = await r.json().catch(() => ({}));
        if (x.checkoutUrl) { window.location.href = x.checkoutUrl; return; } // al volver, Mercado Pago confirma la reserva
        setError(x.error || "No pudimos preparar el pago. Intenta de nuevo."); if (r.status === 409) setRecarga((k) => k + 1);
        return;
      }
      const res = await fetch(cuantos === 2 ? "/api/public/promo/reservar" : "/api/public/book", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuantos === 2
          ? { date: dia, couponCode: promo.codigo, marketingConsent: acepta, personas: grupo.map(datosDe) }
          : { ...datosDe(grupo[0]), date: dia, marketingConsent: acepta, couponCode: promo.codigo }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "No pudimos confirmar. Intenta de nuevo."); if (res.status === 409) setRecarga((k) => k + 1); return; }
      const descuentos: number[] = cuantos === 2 ? (d.reservas || []).map((x: any) => x.promo?.discount || 0) : [d.promo?.discount || 0];
      setListo(grupo.map((g, i) => ({ total: precioDe(g), descuento: descuentos[i] || 0 })));
      window.scrollTo({ top: 0 });
    } catch { setError("Se cortó la conexión. Intenta de nuevo."); }
    finally { setEnviando(false); }
  };
  // Al cambiar de día, las horas ya elegidas dejan de servir (las dos reservas son del mismo día).
  const elegirDia = (d: string) => { setDia(d); setGente((l) => l.map((x) => ({ ...x, turno: null }))); };

  const titulo = "text-[11px] font-light italic uppercase tracking-[0.32em] text-promo-tinta/75";
  const campo = "w-full rounded-xl border border-promo-tinta/15 bg-promo-tinta/5 px-4 py-3 text-promo-tinta placeholder:text-promo-tinta/70 focus:border-promo-tinta focus:outline-none";
  const chip = (on: boolean) => `rounded-xl border px-3 py-2 text-sm font-bold transition ${on ? "border-promo-boton bg-promo-boton text-promo-sobre" : "border-promo-tinta/20 bg-promo-tinta/5 text-promo-tinta hover:border-promo-tinta/60"}`;

  return (
    <main className="min-h-screen bg-promo-papel text-promo-tinta" style={{ ...tema.vars, fontFamily: "Montserrat, -apple-system, Roboto, sans-serif", colorScheme: tema.claro ? "light" : "dark" }}>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,500;0,700;0,800;1,300;1,800&display=swap" rel="stylesheet" />
      <div className="mx-auto min-h-screen max-w-xl px-4 pb-16 pt-6" style={tema.formas ? { backgroundImage: "url('/correo/fondo-oscuro.png')", backgroundSize: "100% auto", backgroundRepeat: "repeat-y" } : undefined}>
        {datos?.negocio.logo && <img src={datos.negocio.logo} alt={datos.negocio.nombre} className={`mx-auto mb-5 h-14 w-auto max-w-[220px] object-contain ${recuadro ? "rounded-xl px-3 py-1" : ""}`} style={recuadro ? { backgroundColor: recuadro } : undefined} />}
        {!datos && !error && <p className="py-20 text-center text-sm text-promo-tinta/75">Cargando promoción…</p>}
        {!datos && error && <p className="py-20 text-center text-sm text-promo-tinta/70">{error}</p>}

        {datos && !promo && (
          <div className="py-16 text-center">
            <p className="text-lg font-extrabold uppercase">{datos.motivo}</p>
            <a href={normal} className="mt-6 inline-block rounded-full bg-promo-boton px-8 py-3 text-sm font-extrabold uppercase italic text-promo-sobre">Reservar sin promoción</a>
          </div>
        )}

        {promo && listo && (
          <div className="rounded-2xl border border-promo-tinta/15 bg-promo-tinta/5 p-6 text-center">
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-promo-boton text-promo-sobre"><Check className="h-7 w-7" strokeWidth={3} /></span>
            <h1 className="text-2xl font-extrabold uppercase">¡Reserva confirmada!</h1>
            <p className="mt-3 font-light text-promo-tinta/80"><b className="font-bold text-promo-tinta">{fechaCorta(dia).largo}</b></p>
            {grupo.map((g, i) => (
              <div key={i} className="mt-4 rounded-xl border border-promo-tinta/15 p-3">
                <p className="text-sm font-light text-promo-tinta/80">{cuantos === 2 && <b className="font-bold text-promo-tinta">{g.nombre} · </b>}<b className="font-bold text-promo-tinta">{g.turno?.slot.slice(11, 16)}</b> con <b className="font-bold text-promo-tinta">{g.turno?.pro.nombre}</b></p>
                {(listo[i]?.descuento || 0) > 0 && <p className="mt-2 text-sm text-promo-tinta/75 line-through">{pesos(listo[i].total)}</p>}
                <p className="text-2xl font-extrabold">{pesos((listo[i]?.total || 0) - (listo[i]?.descuento || 0))}</p>
              </div>
            ))}
            <p className={`mt-3 ${titulo}`}>Pagas en el local · cupón {promo.codigo}</p>
            {cuantos === 2 && <p className="mt-2 text-sm font-light text-promo-tinta/70">El descuento vale si vienen las 2 personas. Si una cancela, la otra paga el precio normal.</p>}
            {promo.detalles.filter((x) => x.etiqueta.startsWith("Pago")).map((x) => <p key={x.etiqueta} className="mt-3 text-sm font-bold">{x.etiqueta}: {x.valor}</p>)}
            <p className="mt-4 text-sm font-light text-promo-tinta/75">Te enviamos los datos a {grupo[0].correo}.</p>
          </div>
        )}

        {promo && !listo && (
          <div className="space-y-7">
            <PromoCabecera imagen={promo.imagen} titulo={promo.titulo || (promo.valor ? (promo.tipo === "percentage" ? `${promo.valor}% de descuento` : `${pesos(promo.valor)} de descuento`) : "Promoción")} descripcion={promo.descripcion} detalles={promo.detalles} codigo={promo.codigo} />

            {cuantos === 2 && (
              <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Persona">
                {grupo.map((g, i) => (
                  <button key={i} type="button" role="tab" aria-selected={activa === i} onClick={() => setActiva(i)} className={`${chip(activa === i)} text-left`}>
                    <span className="block text-[10px] font-light uppercase tracking-widest">Persona {i + 1}</span>
                    <span className="block text-sm">{g.turno ? `✓ ${g.turno.slot.slice(11, 16)} · ${g.turno.pro.nombre.split(" ")[0]}` : "Por elegir"}</span>
                  </button>
                ))}
              </div>
            )}
            {!solo && (
              <section>
                <h2 className={`mb-2 ${titulo}`}>1 · {cuantos === 2 ? `Profesional de la persona ${activa + 1}` : "Elige profesional"}</h2>
                <div className="grid grid-cols-3 gap-2">
                  {disponibles.map((p) => (
                    <button key={p.id} type="button" aria-pressed={miPro === p.id} onClick={() => { if (miPro !== p.id) cambiar(activa, { pro: p.id, elegidos: [], turno: null }); }}
                      className={`${chip(miPro === p.id)} flex flex-col items-center gap-1.5 py-3 text-center`}>
                      {p.foto ? <img src={p.foto} alt="" className="h-14 w-14 rounded-full object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-promo-tinta/15 text-lg font-bold">{p.nombre.charAt(0)}</span>}
                      <span className="text-xs leading-tight">{p.nombre}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {miPro && (
            <section>
              <h2 className={`mb-2 ${titulo}`}>{solo ? 1 : 2} · {cuantos === 2 ? `Servicio de la persona ${activa + 1}` : "Elige tu servicio"}</h2>
              {!catalogo.length && <p className="text-sm text-promo-tinta/70">Cargando servicios…</p>}
              <div className="space-y-2">
                {catalogo.map((s) => {
                  const on = elegidos.includes(s.id);
                  return (
                    <button key={s.id} type="button" aria-pressed={on} onClick={() => setElegidos((l) => (on ? l.filter((x) => x !== s.id) : [...l, s.id]))}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left ${on ? "border-promo-boton bg-promo-boton text-promo-sobre" : "border-promo-tinta/15 bg-promo-tinta/5"}`}>
                      <span className="min-w-0"><span className="block text-sm font-bold">{s.name}</span><span className={`text-xs font-light ${on ? "text-promo-sobre/60" : "text-promo-tinta/70"}`}>{s.duration} min</span></span>
                      <span className="flex-shrink-0 text-right"><span className={`block text-xs line-through ${on ? "text-promo-sobre/60" : "text-promo-tinta/70"}`}>{conDescuento(s.price) < s.price ? pesos(s.price) : ""}</span><span className="text-base font-extrabold">{pesos(conDescuento(s.price))}</span></span>
                    </button>
                  );
                })}
              </div>
            </section>
            )}

            {elegidos.length > 0 && (
              <section>
                <h2 className={`mb-2 ${titulo}`}>{solo ? 2 : 3} · {cuantos === 2 ? `Hora de la persona ${activa + 1} (mismo día para ambas)` : "Elige día y hora"}</h2>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {promo.dias.map((d) => { const f = fechaCorta(d); return (
                    <button key={d} type="button" aria-pressed={dia === d} onClick={() => elegirDia(d)} className={`${chip(dia === d)} min-w-[4.5rem] flex-shrink-0 text-center`}>
                      <span className="block text-[10px] font-light uppercase">{f.dia}</span><span className="block text-xl leading-tight">{f.num}</span><span className="block text-[10px] font-light uppercase">{f.mes}</span>
                    </button>); })}
                </div>
                <div className="mt-3 space-y-3">
                  {cargandoHoras && <p className="text-sm text-promo-tinta/70">Buscando horas…</p>}
                  {!cargandoHoras && !(horas[miPro] || []).length && <p className="rounded-xl border border-promo-tinta/15 bg-promo-tinta/5 px-4 py-3 text-sm text-promo-tinta/70">No quedan horas de la promoción ese día. Prueba otro.</p>}
                  {!cargandoHoras && promo.profesionales.filter((p) => p.id === miPro && (horas[p.id] || []).length > 0).map((p) => (
                    <div key={p.id} className="rounded-2xl border border-promo-tinta/15 bg-promo-tinta/5 p-3">
                      <div className="mb-2 flex items-center gap-2.5">
                        {p.foto ? <img src={p.foto} alt="" className="h-10 w-10 rounded-full object-cover" /> : solo && datos?.negocio.logo ? <img src={datos.negocio.logo} alt="" className="h-10 w-10 rounded-full border border-promo-tinta/15 bg-[#fff] object-contain" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-promo-tinta/15 font-bold">{p.nombre.charAt(0)}</span>}
                        <span className="text-sm font-bold">{p.nombre}</span>
                        <span className="ml-auto text-sm font-extrabold">{pesos(conDescuento(deProfesional(p.id)?.total || 0))}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {(horas[p.id] || []).filter((h) => !choca(p.id, h)).map((h) => <button key={h} type="button" onClick={() => {
                          cambiar(activa, { turno: { pro: p, slot: h } }); setError("");
                          // Con 2 personas: al elegir la primera hora se pasa a la que falta; con todo listo, a los datos.
                          const falta = grupo.findIndex((g, i) => i !== activa && !g.turno);
                          if (falta >= 0) { setActiva(falta); setTimeout(() => window.scrollTo({ top: document.body.scrollHeight / 4, behavior: "smooth" }), 50); }
                          else setTimeout(() => document.getElementById("tus-datos")?.scrollIntoView({ behavior: "smooth" }), 80);
                        }} className={chip(yo.turno?.slot === h && yo.turno?.pro.id === p.id)}>{h.slice(11, 16)}</button>)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {turnosListos && (
              <section id="tus-datos" className="space-y-3">
                <h2 className={titulo}>{solo ? 3 : 4} · {cuantos === 2 ? "Datos de las 2 personas" : "Tus datos"}</h2>
                {grupo.map((g, i) => (
                  <div key={i} className="space-y-2">
                    <p className="rounded-xl border border-promo-tinta/15 bg-promo-tinta/5 px-4 py-3 text-sm font-light">{cuantos === 2 && <b className="font-bold">Persona {i + 1}: </b>}<b className="font-bold">{fechaCorta(dia).largo}, {g.turno!.slot.slice(11, 16)}</b> con <b className="font-bold">{g.turno!.pro.nombre}</b> · <b className="font-extrabold">{pesos(conDescuento(precioDe(g)))}</b></p>
                    <input className={campo} placeholder="Nombre y apellido" autoComplete={i === 0 ? "name" : "off"} value={g.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} />
                    <input className={campo} type="tel" placeholder="Celular (WhatsApp)" autoComplete={i === 0 ? "tel" : "off"} value={g.celular} onChange={(e) => cambiar(i, { celular: e.target.value })} />
                    <input className={campo} type="email" placeholder={i === 0 ? "Correo" : "Correo (opcional)"} autoComplete={i === 0 ? "email" : "off"} value={g.correo} onChange={(e) => cambiar(i, { correo: e.target.value })} />
                  </div>
                ))}
                <label className="flex items-start gap-2 text-xs font-light text-promo-tinta/65"><input type="checkbox" className="mt-0.5" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} /> Quiero recibir promociones y novedades (opcional).</label>
                <p className="text-xs font-light text-promo-tinta/75">Usamos tus datos para gestionar tu cita. <a href="/privacidad/clientes" target="_blank" rel="noopener noreferrer" className="underline">Aviso de privacidad</a></p>
                {promo.politicas && (
                  <div className="rounded-2xl border border-promo-tinta/30 bg-promo-tinta/10 p-4">
                    <p className="mb-2 text-sm font-extrabold uppercase">Antes de confirmar</p>
                    <p className="whitespace-pre-line text-sm font-light text-promo-tinta/85">{promo.politicas}</p>
                    <label className="mt-3 flex items-start gap-2 text-sm font-bold"><input type="checkbox" className="mt-1 h-4 w-4" checked={conforme} onChange={(e) => setConforme(e.target.checked)} /> Leí y acepto estas condiciones.</label>
                  </div>
                )}
                {abono && !abonoSinOnline && (
                  <div className="rounded-2xl border border-promo-tinta/30 bg-promo-tinta/10 p-4">
                    <p className="mb-2 text-sm font-extrabold uppercase">Abono para confirmar</p>
                    <DesgloseAbono r={cuenta} codigo={promo.codigo} />
                    <p className="mt-3 text-sm font-light text-promo-tinta/80">Tienes 5 minutos para pagar el abono con Mercado Pago.</p>
                    {textoPoliticaAbono(abono.deposit_refund_policy, abono.deposit_refund_hours) && <p className="mt-1 text-xs font-light text-promo-tinta/75">{textoPoliticaAbono(abono.deposit_refund_policy, abono.deposit_refund_hours)}</p>}
                  </div>
                )}
                {abonoSinOnline && <p className="rounded-xl border border-promo-tinta/20 bg-promo-tinta/5 px-4 py-3 text-sm">Esta promoción se reserva directamente con el local. Escríbenos para tomar tu hora.</p>}
                {error && <p role="alert" className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-[#fff]">{error}</p>}
                <button type="button" onClick={reservar} disabled={!completo || enviando || revisandoAbono || abonoSinOnline || (!!promo.politicas && !conforme)} className="w-full rounded-full bg-promo-boton py-4 text-base font-extrabold uppercase italic text-promo-sobre disabled:opacity-40">{enviando ? (abono ? "Abriendo el pago…" : "Confirmando…") : abono ? `Pagar abono ${pesos(montoAbono)}` : cuantos === 2 ? "Confirmar las 2 reservas" : "Confirmar reserva"}</button>
              </section>
            )}

            <p className="text-center"><a href={normal} className="inline-flex items-center gap-1 text-xs font-light text-promo-tinta/70 underline"><ChevronLeft className="h-3 w-3" /> Reservar sin promoción</a></p>
          </div>
        )}
      </div>
    </main>
  );
}
